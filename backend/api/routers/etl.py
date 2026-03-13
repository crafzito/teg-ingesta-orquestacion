import asyncio
import datetime
import hashlib
import logging
import subprocess
import sys
import uuid
from pathlib import Path

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..core import (
    ETL_MONITOR_DIRS,
    PROJECT_ROOT,
    execution_item_from_row,
    list_directory_summary,
    readonly_conn,
    write_conn,
)
from ..models import (
    EtlBatchFileItem,
    EtlBatchItem,
    EtlMonitorResponse,
    EtlMonitorSummary,
    EtlRunRequest,
    EtlRunResponse,
    EtlSourceStatus,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/etl", tags=["etl"])

_etl_process: subprocess.Popen | None = None
_EXECUTION_ORDER_SQL = "COALESCE(finished_at, started_at) DESC NULLS LAST, id DESC"
_BATCH_ORDER_SQL = (
    "COALESCE(b.finished_at, b.started_at) DESC NULLS LAST, "
    "b.started_at DESC, b.batch_id DESC"
)
_STALE_AFTER = datetime.timedelta(minutes=30)


def _batch_file_item_from_row(row: tuple) -> EtlBatchFileItem:
    return EtlBatchFileItem(
        id=int(row[0]),
        batch_id=row[1],
        source_key=row[2],
        filename=row[3],
        filepath=row[4],
        status=row[5],
        started_at=row[6],
        finished_at=row[7],
        rows_read=int(row[8] or 0),
        rows_inserted=int(row[9] or 0),
        rows_updated=int(row[10] or 0),
        rows_skipped=int(row[11] or 0),
        rows_rejected=int(row[12] or 0),
        error_message=row[13],
    )


def _batch_item_from_row(row: tuple) -> EtlBatchItem:
    return EtlBatchItem(
        batch_id=row[0],
        trigger_type=row[1],
        scope=row[2],
        status=row[3],
        data_dir=row[4],
        started_at=row[5],
        heartbeat_at=row[6],
        finished_at=row[7],
        file_count=int(row[8] or 0),
        source_count=int(row[9] or 0),
        files_received=int(row[10] or 0),
        files_processing=int(row[11] or 0),
        files_success=int(row[12] or 0),
        files_failed=int(row[13] or 0),
        rows_read_total=int(row[14] or 0),
        rows_inserted_total=int(row[15] or 0),
        rows_updated_total=int(row[16] or 0),
        rows_rejected_total=int(row[17] or 0),
        error_message=row[18],
    )


def _sanitize_stale_executions():
    cutoff = datetime.datetime.now(datetime.timezone.utc) - _STALE_AFTER

    with write_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE etl.executions
                SET
                    status = 'FAILED',
                    finished_at = COALESCE(finished_at, heartbeat_at, started_at),
                    error_message = COALESCE(
                        NULLIF(error_message, ''),
                        'Ejecucion interrumpida por falta de heartbeat'
                    )
                WHERE status = 'RUNNING'
                  AND COALESCE(heartbeat_at, started_at) < %s
                """,
                (cutoff,),
            )

            if cur.rowcount:
                logger.warning(
                    "Se marcaron %s ejecucion(es) RUNNING como interrumpidas por heartbeat vencido",
                    cur.rowcount,
                )


def _sanitize_stale_batches():
    cutoff = datetime.datetime.now(datetime.timezone.utc) - _STALE_AFTER

    with write_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE etl.batches
                SET
                    status = 'FAILED',
                    finished_at = COALESCE(finished_at, heartbeat_at, started_at),
                    error_message = COALESCE(
                        NULLIF(error_message, ''),
                        'Lote interrumpido por falta de heartbeat'
                    )
                WHERE status = 'RUNNING'
                  AND COALESCE(heartbeat_at, started_at) < %s
                RETURNING batch_id
                """,
                (cutoff,),
            )
            stale_batches = [row[0] for row in cur.fetchall()]

            if stale_batches:
                cur.execute(
                    """
                    UPDATE etl.batch_files
                    SET
                        status = 'FAILED',
                        finished_at = COALESCE(finished_at, heartbeat_at, started_at, NOW()),
                        error_message = COALESCE(
                            NULLIF(error_message, ''),
                            'Archivo interrumpido por falta de heartbeat'
                        )
                    WHERE batch_id = ANY(%s)
                      AND status IN ('RECEIVED', 'PROCESSING')
                    """,
                    (stale_batches,),
                )
                logger.warning(
                    "Se marcaron %s lote(s) RUNNING como interrumpidos por heartbeat vencido",
                    len(stale_batches),
                )


def _load_batches(conn, where_sql: str, params: list, limit: int) -> list[EtlBatchItem]:
    batches: list[EtlBatchItem] = []

    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
                b.batch_id,
                b.trigger_type,
                b.scope,
                b.status,
                b.data_dir,
                b.started_at,
                b.heartbeat_at,
                b.finished_at,
                COUNT(f.id)::int AS file_count,
                COUNT(DISTINCT CASE WHEN f.source_key IS NOT NULL THEN f.source_key END)::int AS source_count,
                COUNT(*) FILTER (WHERE f.status = 'RECEIVED')::int AS files_received,
                COUNT(*) FILTER (WHERE f.status = 'PROCESSING')::int AS files_processing,
                COUNT(*) FILTER (WHERE f.status = 'SUCCESS')::int AS files_success,
                COUNT(*) FILTER (WHERE f.status = 'FAILED')::int AS files_failed,
                COALESCE(SUM(f.rows_read), 0)::int AS rows_read_total,
                COALESCE(SUM(f.rows_inserted), 0)::int AS rows_inserted_total,
                COALESCE(SUM(f.rows_updated), 0)::int AS rows_updated_total,
                COALESCE(SUM(f.rows_rejected), 0)::int AS rows_rejected_total,
                COALESCE(NULLIF(b.error_message, ''), MAX(NULLIF(f.error_message, ''))) AS error_message
            FROM etl.batches b
            LEFT JOIN etl.batch_files f ON f.batch_id = b.batch_id
            WHERE {where_sql}
            GROUP BY
                b.batch_id,
                b.trigger_type,
                b.scope,
                b.status,
                b.data_dir,
                b.started_at,
                b.heartbeat_at,
                b.finished_at,
                b.error_message
            ORDER BY {_BATCH_ORDER_SQL}
            LIMIT %s
            """,
            [*params, limit],
        )
        batches = [_batch_item_from_row(row) for row in cur.fetchall()]

        batch_ids = [batch.batch_id for batch in batches]
        if not batch_ids:
            return batches

        cur.execute(
            """
            SELECT
                id,
                batch_id,
                source_key,
                filename,
                filepath,
                status,
                started_at,
                finished_at,
                rows_read,
                rows_inserted,
                rows_updated,
                rows_skipped,
                rows_rejected,
                error_message
            FROM etl.batch_files
            WHERE batch_id = ANY(%s)
            ORDER BY
                batch_id,
                COALESCE(finished_at, started_at, modified_at, created_at) DESC NULLS LAST,
                filename
            """,
            (batch_ids,),
        )
        file_rows = cur.fetchall()

    files_by_batch = {batch.batch_id: [] for batch in batches}
    for row in file_rows:
        item = _batch_file_item_from_row(row)
        files_by_batch.setdefault(item.batch_id, []).append(item)

    for batch in batches:
        batch.files = files_by_batch.get(batch.batch_id, [])

    return batches


def _build_monitor_response() -> EtlMonitorResponse:
    directories = [list_directory_summary(path) for path in ETL_MONITOR_DIRS]
    latest_modified_file_at = max(
        (
            file.modified_at
            for directory in directories
            for file in directory.files
            if file.modified_at is not None
        ),
        default=None,
    )

    summary = EtlMonitorSummary(
        monitored_directories=len(directories),
        total_files=sum(directory.total_files for directory in directories),
        csv_files=sum(directory.csv_files for directory in directories),
        xlsx_files=sum(directory.xlsx_files for directory in directories),
        latest_modified_file_at=latest_modified_file_at,
        running_count=0,
        successful_executions=0,
        failed_executions=0,
        last_started_at=None,
        last_finished_at=None,
        last_success_at=None,
        last_failure_at=None,
        total_sources=0,
        sources_ok=0,
        sources_failed=0,
        sources_running=0,
        running_batches=0,
        successful_batches=0,
        failed_batches=0,
    )
    current_runs = []
    latest_execution = None
    recent_executions = []
    source_status: list[EtlSourceStatus] = []
    current_batches: list[EtlBatchItem] = []
    recent_batches: list[EtlBatchItem] = []
    database_available = True
    database_error = None

    try:
        _sanitize_stale_executions()
        _sanitize_stale_batches()

        with readonly_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                        COUNT(*) FILTER (WHERE status = 'RUNNING'),
                        COUNT(*) FILTER (WHERE status = 'SUCCESS'),
                        COUNT(*) FILTER (WHERE status = 'FAILED'),
                        MAX(started_at),
                        MAX(finished_at),
                        MAX(finished_at) FILTER (WHERE status = 'SUCCESS'),
                        MAX(finished_at) FILTER (WHERE status = 'FAILED')
                    FROM etl.executions
                    """
                )
                exec_agg = cur.fetchone()

                cur.execute(
                    """
                    SELECT
                        COUNT(*) FILTER (WHERE status = 'RUNNING'),
                        COUNT(*) FILTER (WHERE status = 'SUCCESS'),
                        COUNT(*) FILTER (WHERE status IN ('FAILED', 'PARTIAL_FAILED'))
                    FROM etl.batches
                    """
                )
                batch_agg = cur.fetchone()

                summary = EtlMonitorSummary(
                    monitored_directories=summary.monitored_directories,
                    total_files=summary.total_files,
                    csv_files=summary.csv_files,
                    xlsx_files=summary.xlsx_files,
                    latest_modified_file_at=summary.latest_modified_file_at,
                    running_count=int(exec_agg[0] or 0),
                    successful_executions=int(exec_agg[1] or 0),
                    failed_executions=int(exec_agg[2] or 0),
                    last_started_at=exec_agg[3],
                    last_finished_at=exec_agg[4],
                    last_success_at=exec_agg[5],
                    last_failure_at=exec_agg[6],
                    total_sources=0,
                    sources_ok=0,
                    sources_failed=0,
                    sources_running=0,
                    running_batches=int(batch_agg[0] or 0),
                    successful_batches=int(batch_agg[1] or 0),
                    failed_batches=int(batch_agg[2] or 0),
                )

                cur.execute(
                    """
                    SELECT
                        id, batch_id, source_key, filepath, status,
                        started_at, finished_at,
                        rows_read, rows_inserted, rows_updated,
                        rows_skipped, rows_rejected, error_message
                    FROM etl.executions
                    WHERE status = 'RUNNING'
                    ORDER BY started_at DESC
                    """
                )
                current_runs = [execution_item_from_row(row) for row in cur.fetchall()]

                cur.execute(
                    f"""
                    SELECT
                        id, batch_id, source_key, filepath, status,
                        started_at, finished_at,
                        rows_read, rows_inserted, rows_updated,
                        rows_skipped, rows_rejected, error_message
                    FROM etl.executions
                    ORDER BY {_EXECUTION_ORDER_SQL}
                    LIMIT 1
                    """
                )
                latest_row = cur.fetchone()
                latest_execution = execution_item_from_row(latest_row) if latest_row else None

                cur.execute(
                    f"""
                    SELECT
                        id, batch_id, source_key, filepath, status,
                        started_at, finished_at,
                        rows_read, rows_inserted, rows_updated,
                        rows_skipped, rows_rejected, error_message
                    FROM etl.executions
                    ORDER BY {_EXECUTION_ORDER_SQL}
                    LIMIT 15
                    """
                )
                recent_executions = [execution_item_from_row(row) for row in cur.fetchall()]

                cur.execute(
                    """
                    WITH latest_source AS (
                        SELECT DISTINCT ON (source_key)
                            source_key AS archivo,
                            status AS estado,
                            started_at,
                            finished_at,
                            TO_CHAR(finished_at, 'DD/MM/YYYY HH24:MI') AS ultima_carga,
                            rows_read AS leidas,
                            rows_inserted AS nuevas,
                            rows_updated AS actualizadas,
                            rows_skipped AS sin_cambios,
                            rows_rejected AS rechazadas,
                            CASE WHEN COALESCE(rows_read, 0) > 0
                                 THEN ROUND(rows_skipped::numeric / rows_read * 100, 0)::text || '%'
                                 ELSE '—' END AS pct_sin_cambios,
                            error_message AS error
                        FROM etl.executions
                        ORDER BY source_key, COALESCE(finished_at, started_at) DESC NULLS LAST, id DESC
                    )
                    SELECT
                        archivo, estado, ultima_carga, leidas, nuevas,
                        actualizadas, sin_cambios, rechazadas, pct_sin_cambios, error
                    FROM latest_source
                    ORDER BY
                        CASE WHEN estado = 'RUNNING' THEN 0 ELSE 1 END,
                        COALESCE(finished_at, started_at) DESC NULLS LAST,
                        archivo
                    """
                )
                source_status = [
                    EtlSourceStatus(
                        archivo=row[0],
                        estado=row[1],
                        ultima_carga=row[2],
                        leidas=int(row[3] or 0),
                        nuevas=int(row[4] or 0),
                        actualizadas=int(row[5] or 0),
                        sin_cambios=int(row[6] or 0),
                        rechazadas=int(row[7] or 0),
                        pct_sin_cambios=row[8] or "—",
                        error=row[9],
                    )
                    for row in cur.fetchall()
                ]

            current_batches = _load_batches(conn, "b.status = 'RUNNING'", [], 3)
            recent_batches = _load_batches(conn, "b.status <> 'RUNNING'", [], 8)

    except Exception as exc:
        database_available = False
        database_error = str(exc)

    latest_batch = current_batches[0] if current_batches else (recent_batches[0] if recent_batches else None)

    summary = EtlMonitorSummary(
        monitored_directories=summary.monitored_directories,
        total_files=summary.total_files,
        csv_files=summary.csv_files,
        xlsx_files=summary.xlsx_files,
        latest_modified_file_at=summary.latest_modified_file_at,
        running_count=summary.running_count,
        successful_executions=summary.successful_executions,
        failed_executions=summary.failed_executions,
        last_started_at=summary.last_started_at,
        last_finished_at=summary.last_finished_at,
        last_success_at=summary.last_success_at,
        last_failure_at=summary.last_failure_at,
        total_sources=summary.total_sources,
        sources_ok=summary.sources_ok,
        sources_failed=summary.sources_failed,
        sources_running=summary.sources_running,
        running_batches=summary.running_batches,
        successful_batches=summary.successful_batches,
        failed_batches=summary.failed_batches,
        last_batch_id=latest_batch.batch_id if latest_batch else None,
        last_batch_status=latest_batch.status if latest_batch else None,
        batch_id=latest_batch.batch_id if latest_batch else None,
        batch_rows_total=latest_batch.rows_read_total if latest_batch else 0,
    )

    if source_status:
        summary = EtlMonitorSummary(
            monitored_directories=summary.monitored_directories,
            total_files=summary.total_files,
            csv_files=summary.csv_files,
            xlsx_files=summary.xlsx_files,
            latest_modified_file_at=summary.latest_modified_file_at,
            running_count=summary.running_count,
            successful_executions=summary.successful_executions,
            failed_executions=summary.failed_executions,
            last_started_at=summary.last_started_at,
            last_finished_at=summary.last_finished_at,
            last_success_at=summary.last_success_at,
            last_failure_at=summary.last_failure_at,
            total_sources=len(source_status),
            sources_ok=sum(1 for row in source_status if row.estado == "SUCCESS"),
            sources_failed=sum(1 for row in source_status if row.estado == "FAILED"),
            sources_running=sum(1 for row in source_status if row.estado == "RUNNING"),
            running_batches=summary.running_batches,
            successful_batches=summary.successful_batches,
            failed_batches=summary.failed_batches,
            last_batch_id=summary.last_batch_id,
            last_batch_status=summary.last_batch_status,
            batch_id=summary.batch_id,
            batch_rows_total=summary.batch_rows_total,
        )

    return EtlMonitorResponse(
        generated_at=datetime.datetime.now(datetime.timezone.utc).astimezone(),
        database_available=database_available,
        database_error=database_error,
        summary=summary,
        current_runs=current_runs,
        latest_execution=latest_execution,
        recent_executions=recent_executions,
        source_status=source_status,
        current_batches=current_batches,
        recent_batches=recent_batches,
        directories=directories,
    )


@router.get("/monitor", response_model=EtlMonitorResponse)
def get_etl_monitor():
    return _build_monitor_response()


def _is_etl_running() -> bool:
    global _etl_process
    if _etl_process is None:
        return False
    retcode = _etl_process.poll()
    if retcode is not None:
        _etl_process = None
        return False
    return True


@router.post("/run", response_model=EtlRunResponse)
def run_etl(req: EtlRunRequest):
    global _etl_process

    if _is_etl_running():
        return EtlRunResponse(
            status="already_running",
            message=f"ETL ya está ejecutándose (PID {_etl_process.pid})",
            pid=_etl_process.pid,
        )

    data_path = Path(req.data_dir)
    if not data_path.is_absolute():
        data_path = PROJECT_ROOT / data_path
    if not data_path.exists():
        return EtlRunResponse(
            status="error",
            message=f"Directorio no encontrado: {data_path}",
        )

    pipeline_script = PROJECT_ROOT / "etl" / "pipeline.py"
    if not pipeline_script.exists():
        return EtlRunResponse(
            status="error",
            message="pipeline.py no encontrado",
        )

    batch_id = datetime.datetime.now(datetime.timezone.utc).strftime("manual-%Y%m%d-%H%M%S")
    batch_id = f"{batch_id}-{uuid.uuid4().hex[:8]}"

    cmd = [
        sys.executable,
        str(pipeline_script),
        "--dir",
        str(data_path),
        "--batch-id",
        batch_id,
        "--batch-trigger",
        "MANUAL",
    ]
    if req.source:
        cmd.extend(["--source", req.source])
    if req.dry_run:
        cmd.append("--dry-run")
    if req.skip_raw:
        cmd.append("--skip-raw")

    logger.info("Lanzando ETL: %s", " ".join(cmd))
    _etl_process = subprocess.Popen(
        cmd,
        cwd=str(PROJECT_ROOT),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    return EtlRunResponse(
        status="started",
        message=f"ETL iniciado (PID {_etl_process.pid}, batch {batch_id})",
        pid=_etl_process.pid,
        data_dir=str(data_path),
    )


@router.get("/run/status", response_model=EtlRunResponse)
def get_etl_run_status():
    if _is_etl_running():
        return EtlRunResponse(
            status="running",
            message=f"ETL ejecutándose (PID {_etl_process.pid})",
            pid=_etl_process.pid,
        )
    return EtlRunResponse(
        status="idle",
        message="No hay ETL ejecutándose",
    )


@router.websocket("/ws/monitor")
async def ws_etl_monitor(websocket: WebSocket):
    await websocket.accept()
    prev_hash = ""
    try:
        while True:
            response = _build_monitor_response()
            payload = response.model_dump_json()
            current_hash = hashlib.md5(payload.encode()).hexdigest()
            if current_hash != prev_hash:
                await websocket.send_text(payload)
                prev_hash = current_hash
            await asyncio.sleep(3)
    except WebSocketDisconnect:
        pass
    except Exception:
        try:
            await websocket.close()
        except Exception:
            pass

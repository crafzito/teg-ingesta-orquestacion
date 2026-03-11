import datetime

from fastapi import APIRouter

from ..core import ETL_MONITOR_DIRS, execution_item_from_row, list_directory_summary, readonly_conn
from ..models import EtlMonitorResponse, EtlMonitorSummary, EtlSourceStatus

router = APIRouter(prefix="/api/etl", tags=["etl"])


@router.get("/monitor", response_model=EtlMonitorResponse)
def get_etl_monitor():
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
    )
    current_runs = []
    latest_execution = None
    recent_executions = []
    source_status = []
    database_available = True
    database_error = None

    try:
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
                agg = cur.fetchone()
                if agg:
                    summary = EtlMonitorSummary(
                        monitored_directories=summary.monitored_directories,
                        total_files=summary.total_files,
                        csv_files=summary.csv_files,
                        xlsx_files=summary.xlsx_files,
                        latest_modified_file_at=summary.latest_modified_file_at,
                        running_count=int(agg[0] or 0),
                        successful_executions=int(agg[1] or 0),
                        failed_executions=int(agg[2] or 0),
                        last_started_at=agg[3],
                        last_finished_at=agg[4],
                        last_success_at=agg[5],
                        last_failure_at=agg[6],
                        total_sources=0,
                        sources_ok=0,
                        sources_failed=0,
                        sources_running=0,
                    )

                cur.execute(
                    """
                    SELECT
                        id, source_key, filepath, status,
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
                    """
                    SELECT
                        id, source_key, filepath, status,
                        started_at, finished_at,
                        rows_read, rows_inserted, rows_updated,
                        rows_skipped, rows_rejected, error_message
                    FROM etl.executions
                    ORDER BY id DESC
                    LIMIT 1
                    """
                )
                latest_row = cur.fetchone()
                latest_execution = execution_item_from_row(latest_row) if latest_row else None

                cur.execute(
                    """
                    SELECT
                        id, source_key, filepath, status,
                        started_at, finished_at,
                        rows_read, rows_inserted, rows_updated,
                        rows_skipped, rows_rejected, error_message
                    FROM etl.executions
                    ORDER BY id DESC
                    LIMIT 15
                    """
                )
                recent_executions = [execution_item_from_row(row) for row in cur.fetchall()]

                cur.execute(
                    """
                    SELECT
                        archivo, estado, ultima_carga, leidas, nuevas,
                        actualizadas, sin_cambios, rechazadas, pct_sin_cambios, error
                    FROM etl.estado
                    ORDER BY archivo
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
    except Exception as exc:
        database_available = False
        database_error = str(exc)

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
        directories=directories,
    )


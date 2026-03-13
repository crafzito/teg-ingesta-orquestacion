"""
loader.py — Motor de carga UPSERT idempotente para PostgreSQL

Tres modos:
  merge    → INSERT … ON CONFLICT DO UPDATE (solo si la fila cambió)
  snapshot → TRUNCATE para este tipo + INSERT (inventarios)
  catalog  → UPSERT simple para tablas cat.*

Idempotencia en dos niveles:
  1. Archivo: si el MD5 del archivo no cambió desde el último SUCCESS → skip total
  2. Fila:    si el line_hash no cambió → DO NOTHING (0 escrituras)
"""

import hashlib
import json
import logging
import os
from dataclasses import dataclass
from datetime import datetime
from contextlib import contextmanager
from typing import Dict, List, Optional, Tuple

import psycopg2
import psycopg2.extras

logger = logging.getLogger("loader")


@dataclass(frozen=True)
class BatchFileRecord:
    filename: str
    filepath: str
    source_key: Optional[str]
    file_hash: Optional[str]
    size_bytes: int
    modified_at: Optional[datetime]
    status: str = "RECEIVED"


# ── CONEXIÓN ──────────────────────────────────────────────────────

@contextmanager
def get_connection(dsn: str):
    """Context manager de conexión con autocommit en transacciones."""
    conn = psycopg2.connect(dsn)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ── HASH DEL ARCHIVO ─────────────────────────────────────────────

def file_md5(filepath: str) -> str:
    """MD5 del contenido del archivo (para detectar cambios)."""
    h = hashlib.md5()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def ensure_batch(
    conn,
    batch_id: str,
    trigger_type: str,
    data_dir: str,
    files: List[BatchFileRecord],
):
    """Crea o reactiva un lote ETL y registra sus archivos observados."""
    scope = "DELTA" if files else "FULL_SCAN"

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO etl.batches
                (batch_id, trigger_type, scope, status, data_dir)
            VALUES (%s, %s, %s, 'RUNNING', %s)
            ON CONFLICT (batch_id) DO UPDATE SET
                trigger_type = EXCLUDED.trigger_type,
                scope = EXCLUDED.scope,
                status = 'RUNNING',
                data_dir = EXCLUDED.data_dir,
                heartbeat_at = NOW(),
                finished_at = NULL,
                error_message = NULL
            """,
            (batch_id, trigger_type, scope, data_dir),
        )

        if files:
            psycopg2.extras.execute_values(
                cur,
                """
                INSERT INTO etl.batch_files
                    (
                        batch_id, source_key, filename, filepath,
                        file_hash, size_bytes, modified_at, status, heartbeat_at
                    )
                VALUES %s
                ON CONFLICT (batch_id, filepath) DO UPDATE SET
                    source_key = COALESCE(EXCLUDED.source_key, etl.batch_files.source_key),
                    file_hash = EXCLUDED.file_hash,
                    size_bytes = EXCLUDED.size_bytes,
                    modified_at = EXCLUDED.modified_at,
                    status = CASE
                        WHEN etl.batch_files.status IN ('SUCCESS', 'FAILED', 'SKIPPED', 'IGNORED')
                            THEN etl.batch_files.status
                        ELSE EXCLUDED.status
                    END,
                    heartbeat_at = NOW()
                """,
                [
                    (
                        batch_id,
                        item.source_key,
                        item.filename,
                        item.filepath,
                        item.file_hash,
                        item.size_bytes,
                        item.modified_at,
                        item.status,
                    )
                    for item in files
                ],
                template="(%s, %s, %s, %s, %s, %s, %s, %s, NOW())",
                page_size=200,
            )

    conn.commit()


def touch_batch(conn, batch_id: str):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE etl.batches
            SET heartbeat_at = NOW()
            WHERE batch_id = %s
            """,
            (batch_id,),
        )
    conn.commit()


def start_batch_source(
    conn,
    batch_id: str,
    source_key: str,
    execution_id: Optional[int] = None,
):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE etl.batch_files
            SET
                status = 'PROCESSING',
                execution_id = COALESCE(%s, execution_id),
                started_at = COALESCE(started_at, NOW()),
                heartbeat_at = NOW(),
                error_message = NULL
            WHERE batch_id = %s
              AND source_key = %s
              AND status NOT IN ('SUCCESS', 'FAILED', 'IGNORED')
            """,
            (execution_id, batch_id, source_key),
        )

        cur.execute(
            """
            UPDATE etl.batches
            SET heartbeat_at = NOW()
            WHERE batch_id = %s
            """,
            (batch_id,),
        )

    conn.commit()


def update_batch_source_progress(
    conn,
    batch_id: str,
    source_key: str,
    execution_id: Optional[int] = None,
    rows_read: int = 0,
    rows_rejected: int = 0,
):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE etl.batch_files
            SET
                status = 'PROCESSING',
                execution_id = COALESCE(%s, execution_id),
                heartbeat_at = NOW(),
                rows_read = GREATEST(COALESCE(rows_read, 0), %s),
                rows_rejected = GREATEST(COALESCE(rows_rejected, 0), %s)
            WHERE batch_id = %s
              AND source_key = %s
            """,
            (execution_id, rows_read, rows_rejected, batch_id, source_key),
        )

        cur.execute(
            """
            UPDATE etl.batches
            SET heartbeat_at = NOW()
            WHERE batch_id = %s
            """,
            (batch_id,),
        )

    conn.commit()


def finish_batch_source(
    conn,
    batch_id: str,
    source_key: str,
    status: str,
    execution_id: Optional[int] = None,
    rows_read: int = 0,
    rows_inserted: int = 0,
    rows_updated: int = 0,
    rows_skipped: int = 0,
    rows_rejected: int = 0,
    error_msg: Optional[str] = None,
):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE etl.batch_files
            SET
                status = %s,
                execution_id = COALESCE(%s, execution_id),
                heartbeat_at = NOW(),
                finished_at = NOW(),
                rows_read = GREATEST(COALESCE(rows_read, 0), %s),
                rows_inserted = GREATEST(COALESCE(rows_inserted, 0), %s),
                rows_updated = GREATEST(COALESCE(rows_updated, 0), %s),
                rows_skipped = GREATEST(COALESCE(rows_skipped, 0), %s),
                rows_rejected = GREATEST(COALESCE(rows_rejected, 0), %s),
                error_message = %s
            WHERE batch_id = %s
              AND source_key = %s
            """,
            (
                status,
                execution_id,
                rows_read,
                rows_inserted,
                rows_updated,
                rows_skipped,
                rows_rejected,
                error_msg,
                batch_id,
                source_key,
            ),
        )

        cur.execute(
            """
            UPDATE etl.batches
            SET heartbeat_at = NOW()
            WHERE batch_id = %s
            """,
            (batch_id,),
        )

    conn.commit()


def skip_batch_source(conn, batch_id: str, source_key: str, reason: str):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE etl.batch_files
            SET
                status = 'SKIPPED',
                heartbeat_at = NOW(),
                finished_at = COALESCE(finished_at, NOW()),
                error_message = COALESCE(error_message, %s)
            WHERE batch_id = %s
              AND source_key = %s
              AND status IN ('RECEIVED', 'PROCESSING')
            """,
            (reason, batch_id, source_key),
        )

        cur.execute(
            """
            UPDATE etl.batches
            SET heartbeat_at = NOW()
            WHERE batch_id = %s
            """,
            (batch_id,),
        )

    conn.commit()


def complete_batch(
    conn,
    batch_id: str,
    error_msg: Optional[str] = None,
    fail_pending: bool = False,
):
    with conn.cursor() as cur:
        if fail_pending:
            cur.execute(
                """
                UPDATE etl.batch_files
                SET
                    status = 'FAILED',
                    heartbeat_at = NOW(),
                    finished_at = COALESCE(finished_at, NOW()),
                    error_message = COALESCE(error_message, %s)
                WHERE batch_id = %s
                  AND status IN ('RECEIVED', 'PROCESSING')
                """,
                (error_msg or 'Lote interrumpido antes de completar el archivo', batch_id),
            )
        else:
            cur.execute(
                """
                UPDATE etl.batch_files
                SET
                    status = CASE
                        WHEN source_key IS NULL THEN 'IGNORED'
                        ELSE 'SKIPPED'
                    END,
                    heartbeat_at = NOW(),
                    finished_at = COALESCE(finished_at, NOW()),
                    error_message = CASE
                        WHEN source_key IS NULL THEN COALESCE(error_message, 'Archivo sin fuente ETL asociada')
                        ELSE COALESCE(error_message, 'Sin cambios detectados en la fuente')
                    END
                WHERE batch_id = %s
                  AND status = 'RECEIVED'
                """,
                (batch_id,),
            )

            cur.execute(
                """
                UPDATE etl.batch_files
                SET
                    status = 'FAILED',
                    heartbeat_at = NOW(),
                    finished_at = COALESCE(finished_at, NOW()),
                    error_message = COALESCE(error_message, 'Archivo interrumpido durante el cierre del lote')
                WHERE batch_id = %s
                  AND status = 'PROCESSING'
                """,
                (batch_id,),
            )

        cur.execute(
            """
            SELECT
                COUNT(*),
                COUNT(*) FILTER (WHERE status = 'FAILED'),
                COUNT(*) FILTER (WHERE status IN ('SUCCESS', 'SKIPPED', 'IGNORED'))
            FROM etl.batch_files
            WHERE batch_id = %s
            """,
            (batch_id,),
        )
        total_files, failed_files, completed_files = cur.fetchone()

        batch_status = "SUCCESS"
        if total_files and failed_files:
            batch_status = "FAILED" if failed_files == total_files else "PARTIAL_FAILED"
        elif total_files and completed_files == 0 and error_msg:
            batch_status = "FAILED"

        cur.execute(
            """
            UPDATE etl.batches
            SET
                status = %s,
                heartbeat_at = NOW(),
                finished_at = NOW(),
                error_message = COALESCE(%s, error_message)
            WHERE batch_id = %s
            """,
            (batch_status, error_msg, batch_id),
        )

    conn.commit()


# ── CONTROL DE EJECUCIONES ───────────────────────────────────────

def already_loaded(conn, source_key: str, file_hash: str) -> bool:
    """
    Devuelve True si este archivo ya fue cargado exitosamente
    con el mismo hash. El pipeline puede saltarse el procesamiento.
    """
    with conn.cursor() as cur:
        cur.execute("""
            SELECT 1 FROM etl.executions
            WHERE source_key = %s
              AND file_hash   = %s
              AND status      = 'SUCCESS'
            LIMIT 1
        """, (source_key, file_hash))
        return cur.fetchone() is not None


def start_execution(
    conn,
    source_key: str,
    filepath: str,
    file_hash: str,
    batch_id: Optional[str] = None,
) -> int:
    """Registra el inicio de una ejecución. Devuelve el ID."""
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO etl.executions
                (batch_id, source_key, filepath, file_hash, status)
            VALUES (%s, %s, %s, %s, 'RUNNING')
            RETURNING id
        """, (batch_id, source_key, filepath, file_hash))
        exec_id = cur.fetchone()[0]
    conn.commit()
    return exec_id


def update_execution_progress(
    conn,
    exec_id: int,
    rows_read: int = 0,
    rows_rejected: int = 0,
):
    """Actualiza el progreso visible de una ejecución en curso."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE etl.executions SET
                heartbeat_at = NOW(),
                rows_read = GREATEST(COALESCE(rows_read, 0), %s),
                rows_rejected = GREATEST(COALESCE(rows_rejected, 0), %s)
            WHERE id = %s
              AND status = 'RUNNING'
            """,
            (rows_read, rows_rejected, exec_id),
        )
    conn.commit()


def finish_execution(
    conn,
    exec_id:       int,
    status:        str,
    rows_read:     int = 0,
    rows_inserted: int = 0,
    rows_updated:  int = 0,
    rows_skipped:  int = 0,
    rows_rejected: int = 0,
    error_msg:     Optional[str] = None,
):
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE etl.executions SET
                status        = %s,
                heartbeat_at  = NOW(),
                finished_at   = NOW(),
                rows_read     = %s,
                rows_inserted = %s,
                rows_updated  = %s,
                rows_skipped  = %s,
                rows_rejected = %s,
                error_message = %s
            WHERE id = %s
        """, (status, rows_read, rows_inserted, rows_updated,
              rows_skipped, rows_rejected, error_msg, exec_id))
    conn.commit()


def log_reject(conn, exec_id: int, source_key: str,
               row_num: int, raw_data: dict, reason: str):
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO etl.rejects
                    (execution_id, source_key, row_number, raw_data, reject_reason)
                VALUES (%s, %s, %s, %s, %s)
            """, (exec_id, source_key, row_num,
                  json.dumps({k: str(v) for k, v in raw_data.items()},
                             ensure_ascii=False),
                  reason))
    except Exception as e:
        logger.warning(f"No se pudo guardar rechazo: {e}")


# ── CATÁLOGOS ─────────────────────────────────────────────────────

def upsert_catalog(
    conn,
    table: str,
    pairs: List[Tuple[str, str, bool]],   # (cod, descripcion, es_mock)
) -> int:
    """
    UPSERT para tablas cat.*
    Solo actualiza descripcion si es_mock=False (código SAP real).
    Los es_mock=True (generados) no se sobreescriben.
    """
    if not pairs:
        return 0

    sql = f"""
        INSERT INTO {table} (cod, descripcion, es_mock, updated_at)
        VALUES %s
        ON CONFLICT (cod) DO UPDATE SET
            descripcion = EXCLUDED.descripcion,
            es_mock     = EXCLUDED.es_mock,
            updated_at  = NOW()
        WHERE {table}.es_mock = FALSE  -- no sobreescribir mock con real accidentalmente
            OR EXCLUDED.es_mock = FALSE
    """

    with conn.cursor() as cur:
        psycopg2.extras.execute_values(
            cur, sql,
            [(cod, desc, mock) for cod, desc, mock in pairs],
            template="(%s, %s, %s, NOW())",
            page_size=500,
        )
        return cur.rowcount


# ── UPSERT GENÉRICO ───────────────────────────────────────────────

def upsert_rows(
    conn,
    schema:     str,
    table:      str,
    rows:       List[Dict],
    pk_columns: List[str],
    upsert_mode:str = "merge",
    tipo_inv:   Optional[str] = None,  # para snapshot de inventario
) -> Dict[str, int]:
    """
    Inserta / actualiza filas en la tabla destino.

    merge:
      - ON CONFLICT (pk_columns) DO UPDATE solo si line_hash cambió
      - Devuelve {inserted, updated, skipped}

    snapshot:
      - Borra solo las filas del mismo tipo (tipo_inv) y recarga
      - Devuelve {inserted}
    """
    if not rows:
        return {"inserted": 0, "updated": 0, "skipped": 0}

    full_table = f"{schema}.{table}"

    if upsert_mode == "snapshot":
        return _snapshot(conn, full_table, rows, tipo_inv)
    else:
        return _merge(conn, full_table, rows, pk_columns)


def _snapshot(conn, table: str, rows: List[Dict], tipo_inv: Optional[str]) -> Dict:
    """TRUNCATE del tipo + INSERT masivo."""
    cols = list(rows[0].keys())

    lh_idx = cols.index("line_hash") if "line_hash" in cols else None
    seen_hashes = set()
    deduped_rows = []
    for row in rows:
        if lh_idx is None:
            deduped_rows.append(row)
            continue
        line_hash = row.get("line_hash")
        if line_hash in seen_hashes:
            continue
        seen_hashes.add(line_hash)
        deduped_rows.append(row)

    values = [[row.get(c) for c in cols] for row in deduped_rows]

    with conn.cursor() as cur:
        if tipo_inv:
            # Borrar solo este tipo (no tocar PT si estamos cargando MP)
            cur.execute(f"DELETE FROM {table} WHERE tipo_inv = %s", (tipo_inv,))
        else:
            cur.execute(f"TRUNCATE {table}")

        if values:
            psycopg2.extras.execute_values(
                cur,
                f"INSERT INTO {table} ({', '.join(cols)}) VALUES %s",
                values,
                page_size=1000,
            )

    return {
        "inserted": len(deduped_rows),
        "updated": 0,
        "skipped": len(rows) - len(deduped_rows),
    }


def _merge(conn, table: str, rows: List[Dict], pk_columns: List[str]) -> Dict:
    """
    INSERT … ON CONFLICT DO UPDATE si line_hash cambió.
    line_hash es la columna que detecta cambios en la fila completa.
    """
    if not rows:
        return {"inserted": 0, "updated": 0, "skipped": 0}

    cols = list(rows[0].keys())

    # Columnas que se actualizan en DO UPDATE (todo menos la PK y line_hash)
    update_cols = [c for c in cols if c not in pk_columns and c != "line_hash"]

    conflict_target = ", ".join(pk_columns)

    # Si la tabla usa line_hash como PK del conflict (tablas fact con UNIQUE)
    if "line_hash" in cols and "line_hash" not in pk_columns:
        # Usar line_hash como único identificador de fila
        conflict_target = "line_hash"
        # Para tables sin PK declarada, solo usar ON CONFLICT DO NOTHING
        # pero necesitamos contar. Usamos CTE.
        return _merge_via_line_hash(conn, table, cols, rows, update_cols)

    set_clause = ", ".join(
        f"{c} = EXCLUDED.{c}" for c in update_cols if c not in ("_loaded_at",)
    )
    # Solo actualizar si algo cambió realmente
    where_clause = ""
    if "line_hash" in update_cols:
        where_clause = f"WHERE {table}.line_hash IS DISTINCT FROM EXCLUDED.line_hash"

    sql = f"""
        INSERT INTO {table} ({', '.join(cols)})
        VALUES %s
        ON CONFLICT ({conflict_target}) DO UPDATE
        SET {set_clause}
        {where_clause}
    """

    # Deduplicar por conflict_target para evitar "cannot affect row a second time"
    ct_cols = [c.strip() for c in conflict_target.split(",")]
    ct_idxs = [cols.index(c) for c in ct_cols if c in cols]
    seen = set()
    values = []
    for r in rows:
        vals = [r.get(c) for c in cols]
        key = tuple(vals[i] for i in ct_idxs) if ct_idxs else None
        if key and key in seen:
            continue
        if key:
            seen.add(key)
        values.append(vals)

    dupes = len(rows) - len(values)

    with conn.cursor() as cur:
        psycopg2.extras.execute_values(cur, sql, values, page_size=500)
        affected = cur.rowcount

    return {"inserted": affected, "updated": 0, "skipped": len(values) - affected + dupes}


def _merge_via_line_hash(
    conn,
    table:       str,
    cols:        List[str],
    rows:        List[Dict],
    update_cols: List[str],
) -> Dict:
    """
    Upsert usando line_hash como identificador de unicidad.
    Las tablas fact tienen UNIQUE(line_hash) en el schema.
    Si la fila ya existe con el mismo line_hash → DO NOTHING.
    """
    non_pk_update = [c for c in update_cols
                     if c not in ("_loaded_at", "batch_id")]
    set_clause = ", ".join(f"{c} = EXCLUDED.{c}" for c in non_pk_update)

    sql = f"""
        INSERT INTO {table} ({', '.join(cols)})
        VALUES %s
        ON CONFLICT (line_hash) DO UPDATE
        SET {set_clause}
        WHERE {table}.line_hash IS DISTINCT FROM EXCLUDED.line_hash
    """ if non_pk_update else f"""
        INSERT INTO {table} ({', '.join(cols)})
        VALUES %s
        ON CONFLICT (line_hash) DO NOTHING
    """

    # Deduplicar por line_hash (SAP puede exportar filas duplicadas)
    lh_idx = cols.index("line_hash") if "line_hash" in cols else None
    seen_hashes = set()
    deduped = []
    for r in rows:
        vals = [r.get(c) for c in cols]
        if lh_idx is not None:
            lh = vals[lh_idx]
            if lh in seen_hashes:
                continue
            seen_hashes.add(lh)
        deduped.append(vals)

    values = deduped
    inserted = 0
    skipped  = len(rows) - len(values)  # duplicados internos

    # Procesar en batches para medir insertes vs skips
    BATCH = 500
    with conn.cursor() as cur:
        for i in range(0, len(values), BATCH):
            batch = values[i:i + BATCH]
            psycopg2.extras.execute_values(cur, sql, batch, page_size=BATCH)
            affected = cur.rowcount
            inserted += affected
            skipped  += len(batch) - affected

    return {"inserted": inserted, "updated": 0, "skipped": skipped}


# ── UPSERT CATÁLOGOS CON is_mock ──────────────────────────────────

def upsert_catalog_v2(
    conn,
    table: str,
    pairs: List[Tuple],   # (cod, descripcion, es_mock)
) -> Dict[str, int]:
    if not pairs:
        return {"inserted": 0}

    sql = f"""
        INSERT INTO {table} (cod, descripcion, es_mock, updated_at)
        VALUES %s
        ON CONFLICT (cod) DO UPDATE SET
            descripcion = CASE
                WHEN EXCLUDED.es_mock = FALSE THEN EXCLUDED.descripcion
                ELSE {table}.descripcion
            END,
            updated_at = NOW()
    """
    with conn.cursor() as cur:
        psycopg2.extras.execute_values(
            cur, sql,
            [(c, d, m) for c, d, m in pairs],
            template="(%s, %s, %s, NOW())",
            page_size=500,
        )
        return {"inserted": cur.rowcount}


# ── LEER CSV ──────────────────────────────────────────────────────

def read_csv(filepath: str, encoding: str = "latin-1", delimiter: str = ";"):
    """
    Generador: lee el CSV fila por fila como dict.
    Maneja BOM, encoding errors, headers duplicados, filas defectuosas.

    Protecciones:
      - BOM al inicio del archivo
      - Keys None (más campos que headers → separadores extra)
      - Keys vacías después de strip
      - restkey de DictReader (campos excedentes)
    """
    import csv

    with open(filepath, encoding=encoding, errors="replace", newline="") as f:
        # Detectar y saltar BOM
        raw = f.read(3)
        if not raw.startswith("\ufeff"):
            f.seek(0)
        else:
            f.seek(3)

        reader = csv.DictReader(f, delimiter=delimiter)
        for row in reader:
            # Limpiar keys y filtrar None/vacías (filas con separadores extra)
            cleaned = {}
            for k, v in row.items():
                if k is None:
                    # DictReader pone campos excedentes en key=None como lista
                    continue
                key = k.strip()
                if key:
                    cleaned[key] = v
            yield cleaned

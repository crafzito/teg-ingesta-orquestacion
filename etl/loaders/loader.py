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
from contextlib import contextmanager
from typing import Dict, List, Optional, Tuple

import psycopg2
import psycopg2.extras

logger = logging.getLogger("loader")


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


def start_execution(conn, source_key: str, filepath: str, file_hash: str) -> int:
    """Registra el inicio de una ejecución. Devuelve el ID."""
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO etl.executions
                (source_key, filepath, file_hash, status)
            VALUES (%s, %s, %s, 'RUNNING')
            RETURNING id
        """, (source_key, filepath, file_hash))
        exec_id = cur.fetchone()[0]
    conn.commit()
    return exec_id


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
    cols   = list(rows[0].keys())
    values = [[r.get(c) for c in cols] for r in rows]

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

    return {"inserted": len(rows), "updated": 0, "skipped": 0}


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

    values = [[r.get(c) for c in cols] for r in rows]

    with conn.cursor() as cur:
        psycopg2.extras.execute_values(cur, sql, values, page_size=500)
        affected = cur.rowcount

    return {"inserted": affected, "updated": 0, "skipped": len(rows) - affected}


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

    values = [[r.get(c) for c in cols] for r in rows]
    inserted = 0
    skipped  = 0

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
    Maneja BOM, encoding errors, headers duplicados.
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
            # Limpiar keys: algunos headers de SAP tienen espacios extra
            cleaned = {(k or "").strip(): v for k, v in row.items()}
            yield cleaned

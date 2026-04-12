#!/usr/bin/env python3
"""
pipeline.py — Orquestador ETL SAP → PostgreSQL

Uso:
    python pipeline.py --dir /ruta/a/csvs/
    python pipeline.py --dir /ruta/a/csvs/ --dry-run
    python pipeline.py --dir /ruta/a/csvs/ --source PHXX
    python pipeline.py --dir /ruta/a/csvs/ --reset-hash PHXX

Flujo de carga (orden obligatorio):
    1. cat.*          → catálogos (condicion_pago, ramo, zona, etc.)
    2. dim.vendedor   → maestro de vendedores y gerentes
    3. dim.producto   → maestro de materiales (consolida 4 fuentes)
    4. dim.cliente    → maestro de clientes + placeholders
    5. fact.*         → todas las tablas de hechos
    6. raw.*          → CSV crudo histórico (PHXX y CLIENTES)

Idempotencia:
    - Si el archivo no cambió (mismo MD5) → se salta completamente
    - Si cambió → UPSERT fila a fila (line_hash detecta cambios)
    - Seguro de ejecutar N veces al día con el mismo archivo
"""

import argparse
import logging
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Optional

sys.path.insert(0, str(Path(__file__).parent))

from config.sources   import SOURCES, CATALOGS, PRODUCTO_SOURCES, FACT_LOAD_ORDER
from config.columns   import getv, validate_headers
from cleaners.transformers import TRANSFORMER_MAP, set_batch_id, _parse_bool
from cleaners.transformers import transform_raw_ventas, transform_raw_clientes
from loaders.loader   import (
    get_connection, read_csv,
    already_loaded, start_execution, finish_execution, log_reject,
    BatchFileRecord,
    complete_batch,
    ensure_batch,
    file_md5,
    finish_batch_source,
    skip_batch_source,
    start_batch_source,
    touch_batch,
    update_batch_source_progress,
    update_execution_progress,
    upsert_rows, upsert_catalog_v2, _merge_via_line_hash,
)
from parsers.parsers  import normalize_text, normalize_code, mock_code, pk_hash, row_hash
from source_resolver import (
    build_source_group_hash,
    match_source_keys,
    resolve_source_files,
    summarize_source_files,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("pipeline")

# DSN desde variable de entorno
DSN = os.environ.get(
    "PG_DSN",
    "host=localhost dbname=sap_etl user=postgres password=postgres"
)
PROGRESS_EVERY_ROWS = 500


def _get_source_files(source_key: str, data_dir: str):
    return resolve_source_files(data_dir, source_key)


def _iter_source_rows(source_key: str, data_dir: str):
    src_cfg = SOURCES.get(source_key)
    if not src_cfg:
        return

    source_files = _get_source_files(source_key, data_dir)
    for source_file in source_files:
        rows = read_csv(
            str(source_file.path),
            src_cfg.get("encoding", "latin-1"),
            src_cfg.get("delimiter", ";"),
        )
        for row in rows:
            yield source_file, row


def _collect_batch_file_records(
    data_dir: str,
    batch_files: Optional[Iterable[str]],
) -> list[BatchFileRecord]:
    root = Path(data_dir)
    filenames = sorted({name.strip() for name in (batch_files or []) if name and name.strip()})

    if filenames:
        candidates = [root / name for name in filenames]
    else:
        candidates = sorted(
            (
                item for item in root.iterdir()
                if item.is_file() and item.suffix.lower() == ".csv"
            ),
            key=lambda item: item.name.upper(),
        )

    records: list[BatchFileRecord] = []
    for path in candidates:
        if not path.exists() or not path.is_file():
            continue

        matches = match_source_keys(path.name)
        stat = path.stat()
        records.append(
            BatchFileRecord(
                filename=path.name,
                filepath=str(path.resolve()),
                source_key=matches[0] if matches else None,
                file_hash=file_md5(str(path.resolve())),
                size_bytes=stat.st_size,
                modified_at=datetime.fromtimestamp(
                    stat.st_mtime,
                    tz=timezone.utc,
                ).astimezone(),
                status="RECEIVED" if matches else "IGNORED",
            )
        )

    return records


def _run_tracked_source_step(
    source_key: str,
    action,
    batch_id: Optional[str],
    tracked_sources: set[str],
    dry_run: bool,
):
    should_track = not dry_run and batch_id and source_key in tracked_sources

    if should_track:
        with get_connection(DSN) as conn:
            start_batch_source(conn, batch_id, source_key)

    try:
        action()
    except Exception as exc:
        if should_track:
            with get_connection(DSN) as conn:
                finish_batch_source(
                    conn,
                    batch_id,
                    source_key,
                    "FAILED",
                    error_msg=str(exc),
                )
        raise

    if should_track:
        with get_connection(DSN) as conn:
            finish_batch_source(conn, batch_id, source_key, "SUCCESS")


# ──────────────────────────────────────────────────────────────────
# PASO 1: Catálogos
# ──────────────────────────────────────────────────────────────────

def load_catalogs(data_dir: str, dry_run: bool = False):
    """
    Extrae pares cod+descripcion de los archivos fuente
    y hace UPSERT en las tablas cat.*
    """
    logger.info("── PASO 1: Catálogos ──────────────────────────────")

    # Agrupar por archivo fuente para leer cada archivo solo una vez
    by_source = {}
    for table, src_key, cod_col, desc_col, es_mock in CATALOGS:
        by_source.setdefault(src_key, []).append(
            (table, cod_col, desc_col, es_mock)
        )

    for src_key, entries in by_source.items():
        src_cfg  = SOURCES.get(src_key)
        if not src_cfg:
            continue
        source_files = _get_source_files(src_key, data_dir)
        if not source_files:
            logger.warning(f"  [cat] {src_key}: sin archivos en {data_dir}")
            continue

        # Leer todas las filas una vez
        rows = []
        for source_file in source_files:
            rows.extend(
                read_csv(str(source_file.path), src_cfg["encoding"], src_cfg["delimiter"])
            )

        for table, cod_col, desc_col, es_mock in entries:
            pairs = {}
            for row in rows:
                cod  = normalize_code(row.get(cod_col) or "")
                desc = normalize_text(row.get(desc_col) or cod or "")
                if not cod:
                    continue
                # Para es_mock, generar código desde texto
                if es_mock:
                    cod = mock_code(cod)
                if cod not in pairs:
                    pairs[cod] = (cod, desc or cod, es_mock)

            logger.info(f"  {table}: {len(pairs)} valores únicos")
            if dry_run:
                continue
            with get_connection(DSN) as conn:
                result = upsert_catalog_v2(conn, table, list(pairs.values()))
                logger.info(f"  {table}: {result['inserted']} procesados")


# ──────────────────────────────────────────────────────────────────
# PASO 2: dim.vendedor
# ──────────────────────────────────────────────────────────────────

def load_dim_vendedor(data_dir: str, dry_run: bool = False):
    logger.info("── PASO 2: dim.vendedor ───────────────────────────")

    src_cfg  = SOURCES["CLIENTES"]
    source_files = _get_source_files("CLIENTES", data_dir)
    if not source_files:
        logger.warning("  CLIENTES: sin archivos de clientes")
        return

    SK = "CLIENTES"
    vendedores = {}
    for _, row in _iter_source_rows("CLIENTES", data_dir):
        # Vendedores
        cod = normalize_code(getv(row, SK, "Cod.Vend") or "")
        nom = normalize_text(getv(row, SK, "Nombre_vendedor") or "")
        if cod and cod not in vendedores:
            vendedores[cod] = {"cod_vendedor": cod, "nombre_vendedor": nom, "tipo": "VENDEDOR"}

        # Gerentes regionales
        cod_g = normalize_code(getv(row, SK, "Cód.Ger.Reg.") or "")
        nom_g = normalize_text(getv(row, SK, "Nombre Gte. Regional") or "")
        if cod_g and cod_g not in vendedores:
            vendedores[cod_g] = {"cod_vendedor": cod_g, "nombre_vendedor": nom_g, "tipo": "GERENTE"}

    logger.info(f"  {len(vendedores)} vendedores/gerentes")
    if dry_run:
        return

    rows = []
    for v in vendedores.values():
        v["batch_id"] = _BATCH_ID
        rows.append(v)

    with get_connection(DSN) as conn:
        result = upsert_rows(conn, "dim", "vendedor", rows,
                             pk_columns=["cod_vendedor"])
        logger.info(f"  dim.vendedor: {result}")


# ──────────────────────────────────────────────────────────────────
# PASO 3: dim.producto
# ──────────────────────────────────────────────────────────────────

def load_dim_producto(data_dir: str, dry_run: bool = False):
    logger.info("── PASO 3: dim.producto ───────────────────────────")

    # Producto consolida múltiples fuentes, en orden de prioridad
    productos: dict = {}

    for src_key, col_map in PRODUCTO_SOURCES:
        src_cfg  = SOURCES.get(src_key)
        if not src_cfg:
            continue
        source_files = _get_source_files(src_key, data_dir)
        if not source_files:
            continue

        for _, row in _iter_source_rows(src_key, data_dir):
            codigo_mat = normalize_code(row.get("Codigo_Mat") or "")
            if not codigo_mat:
                continue

            if codigo_mat not in productos:
                productos[codigo_mat] = {"codigo_mat": codigo_mat}

            p = productos[codigo_mat]

            for csv_col, dim_col in col_map.items():
                # Solo sobreescribir si el atributo aún no tiene valor
                if dim_col not in p or not p[dim_col]:
                    val = normalize_text(row.get(csv_col) or "")
                    if val:
                        p[dim_col] = val

    # Resolver sector_texto → sector_cod (FK a cat.sector)
    # Los códigos de cat.sector son MD5 del texto
    for p in productos.values():
        sector_texto = p.pop("sector_texto", None)
        if sector_texto and "sector_cod" not in p:
            p["sector_cod"] = mock_code(sector_texto)

    # Asegurar denominacion_material no es None
    for codigo_mat, p in productos.items():
        if not p.get("denominacion_material"):
            p["denominacion_material"] = codigo_mat  # fallback al código

    logger.info(f"  {len(productos)} productos encontrados")
    if dry_run:
        return

    rows = []
    for p in productos.values():
        p["batch_id"] = _BATCH_ID
        rows.append(p)

    with get_connection(DSN) as conn:
        result = upsert_rows(conn, "dim", "producto", rows,
                             pk_columns=["codigo_mat"])
        logger.info(f"  dim.producto: {result}")


# ──────────────────────────────────────────────────────────────────
# PASO 4: dim.cliente
# ──────────────────────────────────────────────────────────────────

def load_dim_cliente(data_dir: str, dry_run: bool = False):
    logger.info("── PASO 4: dim.cliente ────────────────────────────")

    src_cfg  = SOURCES["CLIENTES"]
    source_files = _get_source_files("CLIENTES", data_dir)
    if not source_files:
        logger.warning("  CLIENTES: sin archivos de clientes")
        return

    from parsers.parsers import parse_date

    SK = "CLIENTES"
    seen = {}  # dedup por cod_cliente (CLIENTES.CSV puede tener duplicados)
    for _, row in _iter_source_rows("CLIENTES", data_dir):
        cod = normalize_code(getv(row, SK, "Cod. Cliente") or "")
        if not cod or cod in seen:
            continue

        cod_vend    = normalize_code(getv(row, SK, "Cod.Vend") or "")
        cod_gerente = normalize_code(getv(row, SK, "Cód.Ger.Reg.") or "")

        clean = {
            "cod_cliente":            cod,
            "nombre_cliente":         normalize_text(getv(row, SK, "Nombre Sol.") or ""),
            "rif":                    normalize_code(getv(row, SK, "RIF") or ""),
            "direccion":              normalize_text(getv(row, SK, "Dirección") or ""),
            "telefono_fijo":          normalize_text(getv(row, SK, "Telefono") or ""),
            "telefono_movil":         normalize_text(getv(row, SK, "Teléfono móvil") or ""),
            "nombre_contacto":        normalize_text(getv(row, SK, "Nombre persona conta") or ""),
            "poblacion":              normalize_text(getv(row, SK, "Poblacion") or ""),
            "estado":                 normalize_text(getv(row, SK, "Descrip. Estado") or ""),
            "moneda":                 normalize_code(getv(row, SK, "Moneda") or ""),
            "cod_ruta_transporte":    normalize_code(getv(row, SK, "Ruta Transp.") or ""),
            "fecha_creacion_cliente": parse_date(getv(row, SK, "Fecha de creacion") or ""),
            "agente_retencion_flag":  _parse_bool(getv(row, SK, "AG. RET.") or ""),
            "num_ultima_factura":     normalize_code(getv(row, SK, "Ult.Fact") or ""),
            "fecha_ultima_factura":   parse_date(getv(row, SK, "Fecha Fact") or ""),
            "num_ultimo_pago":        normalize_code(getv(row, SK, "Doc.Ult.Pago") or ""),
            "fecha_ultimo_pago":      parse_date(getv(row, SK, "Fecha Pago") or ""),
            "cod_condicion_pago":     normalize_code(getv(row, SK, "Cond. Pago") or ""),
            "cod_ramo":               normalize_code(getv(row, SK, "Ramo") or ""),
            "cod_gpo_cliente":        normalize_code(getv(row, SK, "Gr Clientes") or ""),
            "cod_zona_ventas":        normalize_code(getv(row, SK, "Zona Ventas") or ""),
            "cod_grp_vendedor":       normalize_code(getv(row, SK, "Grupo Vend.") or ""),
            "cod_lista_precio":       normalize_code(getv(row, SK, "Lista") or ""),
            "cod_canal":              normalize_code(getv(row, SK, "Canal") or ""),
            "cod_vendedor":           cod_vend  or None,
            "cod_gerente":            cod_gerente or None,
            "is_placeholder":         False,
            "is_active":              True,
            "batch_id":               _BATCH_ID,
        }
        seen[cod] = clean

    rows = list(seen.values())
    logger.info(f"  {len(rows)} clientes en maestro")
    if dry_run:
        return

    with get_connection(DSN) as conn:
        result = upsert_rows(conn, "dim", "cliente", rows,
                             pk_columns=["cod_cliente"])
        logger.info(f"  dim.cliente: {result}")

        # Crear placeholders para clientes que aparecen en ventas
        # pero no están en el maestro de clientes
        _ensure_client_placeholders(conn, data_dir)


def _ensure_client_placeholders(conn, data_dir: str):
    """
    Los 381 clientes que aparecen en PHXX pero no en CLIENTES
    se insertan como placeholder para que las FKs no fallen.
    """
    if not SOURCES.get("PHXX"):
        return
    source_files = _get_source_files("PHXX", data_dir)
    if not source_files:
        return

    clientes_ventas = set()
    for _, row in _iter_source_rows("PHXX", data_dir):
        cod = normalize_code(row.get("Cod_cliente") or "")
        if cod:
            clientes_ventas.add(cod)

    with conn.cursor() as cur:
        cur.execute("SELECT cod_cliente FROM dim.cliente")
        clientes_existentes = {r[0] for r in cur.fetchall()}

    huerfanos = clientes_ventas - clientes_existentes
    if not huerfanos:
        return

    logger.info(f"  Creando {len(huerfanos)} clientes placeholder")
    placeholders = []
    for cod in huerfanos:
        # Intentar sacar nombre de PHXX (columna Razón Social)
        placeholders.append({
            "cod_cliente":    cod,
            "nombre_cliente": f"[PLACEHOLDER] {cod}",
            "is_placeholder": True,
            "is_active":      True,
            "batch_id":       _BATCH_ID,
        })

    upsert_rows(conn, "dim", "cliente", placeholders,
                pk_columns=["cod_cliente"])


# ──────────────────────────────────────────────────────────────────
# Validación de headers CSV
# ──────────────────────────────────────────────────────────────────

def _validate_csv_headers(source_key: str, filepath: str, src_cfg: dict):
    """
    Lee la primera fila del CSV para extraer headers y valida contra
    COLUMN_ALIASES. Fail-fast si faltan columnas PK (críticas).
    """
    import csv

    encoding  = src_cfg.get("encoding", "latin-1")
    delimiter = src_cfg.get("delimiter", ";")
    pk_cols   = src_cfg.get("pk_cols", [])

    with open(filepath, encoding=encoding, errors="replace", newline="") as f:
        raw = f.read(3)
        if not raw.startswith("\ufeff"):
            f.seek(0)
        else:
            f.seek(3)
        reader = csv.reader(f, delimiter=delimiter)
        try:
            actual_headers = [h.strip() for h in next(reader)]
        except StopIteration:
            raise RuntimeError(f"[{source_key}] CSV vacío: {filepath}")

    result = validate_headers(source_key, actual_headers, critical_cols=pk_cols)

    if result["missing_critical"]:
        msg = (f"[{source_key}] HEADERS CRÍTICOS FALTANTES: "
               f"{result['missing_critical']}. "
               f"Headers reales: {actual_headers[:10]}...")
        logger.error(msg)
        raise RuntimeError(msg)

    if result["missing_optional"]:
        logger.warning(
            f"[{source_key}] Headers opcionales sin match: "
            f"{result['missing_optional']}"
        )

    if result["unexpected"]:
        logger.info(
            f"[{source_key}] Headers nuevos/inesperados en CSV: "
            f"{result['unexpected'][:10]}"
        )


# ──────────────────────────────────────────────────────────────────
# PASO 5: Tablas de hechos
# ──────────────────────────────────────────────────────────────────

def load_fact(source_key: str, data_dir: str, dry_run: bool = False):
    """Carga una tabla de hechos usando el transformer correspondiente."""

    src_cfg = SOURCES.get(source_key)
    if not src_cfg:
        logger.error(f"[{source_key}] Fuente desconocida")
        return

    source_files = _get_source_files(source_key, data_dir)
    if not source_files:
        logger.warning(f"[{source_key}] Sin archivos en {data_dir}")
        return

    transformer = TRANSFORMER_MAP.get(source_key)
    if not transformer:
        logger.warning(f"[{source_key}] Sin transformer, saltando")
        return

    schema, table = src_cfg["table"]
    fhash = build_source_group_hash(source_files)
    file_label = summarize_source_files(source_files)
    exec_id = None
    last_progress_row_num = 0

    # Nivel 1 de idempotencia: mismo archivo → skip total
    if not dry_run:
        with get_connection(DSN) as conn:
            if already_loaded(conn, source_key, fhash):
                logger.info(f"[{source_key}] Sin cambios (mismo MD5) → skip")
                if _BATCH_ID:
                    skip_batch_source(
                        conn,
                        _BATCH_ID,
                        source_key,
                        "Sin cambios (mismo MD5)",
                    )
                return
            exec_id = start_execution(conn, source_key, file_label, fhash, batch_id=_BATCH_ID)
            if _BATCH_ID:
                start_batch_source(conn, _BATCH_ID, source_key, execution_id=exec_id)

    logger.info(
        f"[{source_key}] Procesando {len(source_files)} archivo(s): "
        f"{', '.join(source_file.filename for source_file in source_files)}"
    )

    clean_rows = []
    rejected   = []
    row_num = 0

    for source_file in source_files:
        _validate_csv_headers(source_key, str(source_file.path), src_cfg)

        for raw_row in read_csv(
            str(source_file.path),
            src_cfg["encoding"],
            src_cfg["delimiter"],
        ):
            row_num += 1

            # Hardening: rechazar filas con keys None (separadores extra)
            if None in raw_row or "" in raw_row.values():
                none_keys = [k for k in raw_row if k is None]
                if none_keys:
                    rejected.append((
                        row_num,
                        raw_row,
                        f"{source_file.filename}: fila defectuosa: "
                        f"{len(none_keys)} columnas sin header (separadores extra)",
                    ))
                    continue

            result = transformer(raw_row)
            if result.is_valid:
                clean_rows.append(result.row)
            else:
                rejected.append((
                    row_num,
                    raw_row,
                    f"{source_file.filename}: {'; '.join(result.errors)}",
                ))

            if (
                not dry_run
                and exec_id is not None
                and row_num - last_progress_row_num >= PROGRESS_EVERY_ROWS
            ):
                with get_connection(DSN) as progress_conn:
                    update_execution_progress(
                        progress_conn,
                        exec_id,
                        rows_read=row_num,
                        rows_rejected=len(rejected),
                    )
                    if _BATCH_ID:
                        update_batch_source_progress(
                            progress_conn,
                            _BATCH_ID,
                            source_key,
                            execution_id=exec_id,
                            rows_read=row_num,
                            rows_rejected=len(rejected),
                        )
                last_progress_row_num = row_num

        if (
            not dry_run
            and exec_id is not None
            and row_num > last_progress_row_num
        ):
            with get_connection(DSN) as progress_conn:
                update_execution_progress(
                    progress_conn,
                    exec_id,
                    rows_read=row_num,
                    rows_rejected=len(rejected),
                )
                if _BATCH_ID:
                    update_batch_source_progress(
                        progress_conn,
                        _BATCH_ID,
                        source_key,
                        execution_id=exec_id,
                        rows_read=row_num,
                        rows_rejected=len(rejected),
                    )
            last_progress_row_num = row_num

    logger.info(
        f"[{source_key}] {row_num} leídas | "
        f"{len(clean_rows)} válidas | {len(rejected)} rechazadas"
    )

    if dry_run:
        logger.info(f"[{source_key}] [DRY-RUN] no se escribe en BD")
        return

    tipo_inv = src_cfg.get("tipo_inv")

    try:
        with get_connection(DSN) as conn:
            stats = upsert_rows(
                conn, schema, table, clean_rows,
                pk_columns=["line_hash"],
                upsert_mode=src_cfg.get("upsert_mode", "merge"),
                tipo_inv=tipo_inv,
            )
            logger.info(f"[{source_key}] {schema}.{table}: {stats}")

            for rn, raw, reason in rejected[:200]:
                log_reject(conn, exec_id, source_key, rn, raw, reason)

            finish_execution(
                conn, exec_id, "SUCCESS",
                rows_read=row_num,
                rows_inserted=stats.get("inserted", 0),
                rows_updated=stats.get("updated", 0),
                rows_skipped=stats.get("skipped", 0),
                rows_rejected=len(rejected),
            )
            if _BATCH_ID:
                finish_batch_source(
                    conn,
                    _BATCH_ID,
                    source_key,
                    "SUCCESS",
                    execution_id=exec_id,
                    rows_read=row_num,
                    rows_inserted=stats.get("inserted", 0),
                    rows_updated=stats.get("updated", 0),
                    rows_skipped=stats.get("skipped", 0),
                    rows_rejected=len(rejected),
                )

    except Exception as e:
        logger.error(f"[{source_key}] ERROR: {e}", exc_info=True)
        if not dry_run:
            with get_connection(DSN) as conn:
                finish_execution(conn, exec_id, "FAILED", error_msg=str(e))
                if _BATCH_ID:
                    finish_batch_source(
                        conn,
                        _BATCH_ID,
                        source_key,
                        "FAILED",
                        execution_id=exec_id,
                        rows_read=row_num,
                        rows_rejected=len(rejected),
                        error_msg=str(e),
                    )
        raise


# ──────────────────────────────────────────────────────────────────
# PASO 6: Raw histórico (PHXX y CLIENTES)
# ──────────────────────────────────────────────────────────────────

def load_raw(data_dir: str, dry_run: bool = False):
    """
    Guarda los CSV originales:
      1. raw.ventas / raw.clientes  (compatibilidad temporal)
      2. raw.source_data (JSONB)    (todas las fuentes, genérico)
    """
    import json as _json
    import psycopg2.extras

    logger.info("── PASO 6: Raw histórico ──────────────────────────")

    # ── 6a: Tablas legacy (raw.ventas, raw.clientes) ──────────────
    legacy_jobs = [
        ("PHXX",     "raw.ventas",   transform_raw_ventas),
        ("CLIENTES", "raw.clientes", transform_raw_clientes),
    ]

    for src_key, raw_table, transform_fn in legacy_jobs:
        src_cfg  = SOURCES.get(src_key)
        source_files = _get_source_files(src_key, data_dir)
        if not source_files:
            logger.warning(f"  [{src_key}] no encontrado, saltando raw")
            continue

        logger.info(f"  [{src_key}] → {raw_table}")
        rows = []
        for source_file in source_files:
            for raw_row in read_csv(
                str(source_file.path),
                src_cfg["encoding"],
                src_cfg["delimiter"],
            ):
                record = transform_fn(raw_row, source_file.filename, _BATCH_ID)
                rows.append(record)

        logger.info(f"  [{src_key}] {len(rows)} filas raw")
        if dry_run or not rows:
            continue

        cols = list(rows[0].keys())

        with get_connection(DSN) as conn:
            sql = f"""
                INSERT INTO {raw_table} ({', '.join(cols)})
                VALUES %s
                ON CONFLICT (pk_hash) DO UPDATE SET
                    row_hash    = EXCLUDED.row_hash,
                    loaded_at   = NOW(),
                    batch_id    = EXCLUDED.batch_id
                WHERE {raw_table}.row_hash IS DISTINCT FROM EXCLUDED.row_hash
            """
            # Deduplicar por pk_hash (SAP exporta filas duplicadas)
            pk_idx = cols.index("pk_hash") if "pk_hash" in cols else None
            seen_pk = set()
            values = []
            for r in rows:
                vals = [r.get(c) for c in cols]
                if pk_idx is not None:
                    pk = vals[pk_idx]
                    if pk in seen_pk:
                        continue
                    seen_pk.add(pk)
                values.append(vals)

            dupes = len(rows) - len(values)
            if dupes:
                logger.info(f"  [{src_key}] {dupes} duplicados internos eliminados")

            with conn.cursor() as cur:
                psycopg2.extras.execute_values(cur, sql, values, page_size=500)
                affected = cur.rowcount
            logger.info(f"  [{src_key}] raw legacy: {affected} procesados")
            if _BATCH_ID:
                touch_batch(conn, _BATCH_ID)

    # ── 6b: raw.source_data (JSONB genérico, todas las fuentes) ───
    logger.info("  ── raw.source_data (JSONB genérico) ──")

    for src_key, src_cfg in SOURCES.items():
        source_files = _get_source_files(src_key, data_dir)
        if not source_files:
            logger.debug(f"  [{src_key}] no encontrado, saltando raw genérico")
            continue

        pk_cols = src_cfg.get("pk_cols", [])
        batch = []

        for source_file in source_files:
            for raw_row in read_csv(
                str(source_file.path),
                src_cfg["encoding"],
                src_cfg["delimiter"],
            ):
                # PK hash: a partir de las pk_cols definidas en SOURCES
                pk_values = [raw_row.get(c, "") for c in pk_cols]
                p_hash = pk_hash(*pk_values) if pk_values else pk_hash(
                    _json.dumps(raw_row, ensure_ascii=False, sort_keys=True)
                )
                r_hash = row_hash(raw_row)
                data_json = _json.dumps(
                    {k: v for k, v in raw_row.items() if k},
                    ensure_ascii=False,
                )

                batch.append((
                    src_key,
                    p_hash,
                    r_hash,
                    data_json,
                    source_file.filename,
                    _BATCH_ID,
                ))

        # Deduplicar por pk_hash (posición 1 en la tupla)
        seen_pk = set()
        deduped = []
        for row in batch:
            pk = row[1]  # p_hash
            if pk in seen_pk:
                continue
            seen_pk.add(pk)
            deduped.append(row)

        dupes = len(batch) - len(deduped)
        logger.info(f"  [{src_key}] {len(batch)} filas → raw.source_data"
                     + (f" ({dupes} duplicados eliminados)" if dupes else ""))

        if dry_run or not deduped:
            continue

        with get_connection(DSN) as conn:
            sql = """
                INSERT INTO raw.source_data
                    (source_key, pk_hash, row_hash, data, source_file, batch_id)
                VALUES %s
                ON CONFLICT (source_key, pk_hash) DO UPDATE SET
                    row_hash    = EXCLUDED.row_hash,
                    data        = EXCLUDED.data,
                    source_file = EXCLUDED.source_file,
                    batch_id    = EXCLUDED.batch_id,
                    loaded_at   = NOW()
                WHERE raw.source_data.row_hash IS DISTINCT FROM EXCLUDED.row_hash
            """
            with conn.cursor() as cur:
                psycopg2.extras.execute_values(
                    cur, sql, deduped,
                    template="(%s, %s, %s, %s::jsonb, %s, %s)",
                    page_size=500,
                )
                affected = cur.rowcount
            logger.info(f"  [{src_key}] raw genérico: {affected} procesados")
            if _BATCH_ID:
                touch_batch(conn, _BATCH_ID)


# ──────────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────────

_BATCH_ID = str(uuid.uuid4())
_BATCH_SOURCE_KEYS: set[str] = set()


def run(
    data_dir:      str,
    source_filter: Optional[str] = None,
    dry_run:       bool = False,
    skip_raw:      bool = False,
    batch_id:      Optional[str] = None,
    batch_trigger: str = "MANUAL",
    batch_files:   Optional[list[str]] = None,
):
    global _BATCH_ID, _BATCH_SOURCE_KEYS

    _BATCH_ID = batch_id or str(uuid.uuid4())
    set_batch_id(_BATCH_ID)
    batch_records = _collect_batch_file_records(data_dir, batch_files)
    _BATCH_SOURCE_KEYS = {
        record.source_key for record in batch_records if record.source_key
    }

    if not dry_run:
        with get_connection(DSN) as conn:
            ensure_batch(
                conn,
                batch_id=_BATCH_ID,
                trigger_type=batch_trigger,
                data_dir=data_dir,
                files=batch_records,
            )

    logger.info("=" * 60)
    logger.info(f"ETL Pipeline  batch={_BATCH_ID[:8]}")
    logger.info(f"dir={data_dir}  dry_run={dry_run}  trigger={batch_trigger}")
    if batch_records:
        logger.info(
            "Archivos del lote: %s",
            ", ".join(record.filename for record in batch_records),
        )
    logger.info("=" * 60)

    def _load_client_bundle():
        load_dim_vendedor(data_dir, dry_run)
        load_dim_cliente(data_dir, dry_run)

    try:
        if source_filter:
            logger.info(f"Modo foco: procesando solo {source_filter}")
            load_fact(source_filter, data_dir, dry_run)
        else:
            load_catalogs(data_dir, dry_run)
            _run_tracked_source_step(
                "CLIENTES",
                _load_client_bundle,
                batch_id=_BATCH_ID,
                tracked_sources=_BATCH_SOURCE_KEYS,
                dry_run=dry_run,
            )
            load_dim_producto(data_dir, dry_run)

            for current_source_key in FACT_LOAD_ORDER:
                load_fact(current_source_key, data_dir, dry_run)

            if not skip_raw:
                load_raw(data_dir, dry_run)

            if not dry_run:
                refresh_materialized_views()

    except Exception as exc:
        if not dry_run:
            with get_connection(DSN) as conn:
                complete_batch(
                    conn,
                    _BATCH_ID,
                    error_msg=str(exc),
                    fail_pending=True,
                )
        raise

    if not dry_run:
        with get_connection(DSN) as conn:
            complete_batch(conn, _BATCH_ID)

    logger.info("=" * 60)
    logger.info("Pipeline completado.")
    logger.info("=" * 60)


# ──────────────────────────────────────────────────────────────────
# Refresh vistas materializadas (Looker Studio)
# ──────────────────────────────────────────────────────────────────

_REPORTING_ARTIFACTS = [
    "public.v_ventas",
    "public.v_cxc",
    "public.v_cxp",
    "public.v_inventario",
    "public.v_ordenes",
    "public.v_pedidos",
]


def refresh_materialized_views():
    """Refresca solo los materialized views existentes y valida que las vistas
    reporting/public esperadas sigan disponibles.

    El esquema actual define `public.v_*` como vistas normales; intentar hacer
    `REFRESH MATERIALIZED VIEW` sobre ellas genera errores ruidosos y confusos
    al final del pipeline. Este helper detecta qué artefactos son realmente
    materialized views antes de refrescarlos.
    """
    logger.info("── Validando artefactos reporting/public ───────────")
    with get_connection(DSN) as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT schemaname || '.' || matviewname
                FROM pg_matviews
                WHERE schemaname = 'public'
                """
            )
            materialized_views = {row[0] for row in cur.fetchall()}

            for artifact in _REPORTING_ARTIFACTS:
                if artifact in materialized_views:
                    try:
                        cur.execute(f"REFRESH MATERIALIZED VIEW {artifact}")
                        logger.info(f"  {artifact} materialized view refrescada ✓")
                    except Exception as e:
                        logger.warning(f"  {artifact} materialized view FALLÓ: {e}")
                    continue

                cur.execute("SELECT to_regclass(%s)", (artifact,))
                regclass = cur.fetchone()[0]
                if regclass:
                    logger.info(f"  {artifact} es vista/tablas normal; no requiere refresh")
                else:
                    logger.warning(f"  {artifact} no existe en la base de datos")
        conn.autocommit = False


def reset_file_hash(source_key: str):
    """
    Borra el registro de última carga exitosa para forzar reprocesamiento.
    Útil si hay un bug en el ETL y quieres reprocesar sin cambiar el CSV.
    """
    with get_connection(DSN) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE etl.executions
                SET status = 'RESET'
                WHERE source_key = %s AND status = 'SUCCESS'
            """, (source_key,))
            logger.info(f"Hash reseteado para {source_key} ({cur.rowcount} registros)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="ETL Pipeline SAP → PostgreSQL",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos:
  python pipeline.py --dir /datos/sap/
  python pipeline.py --dir /datos/sap/ --dry-run
  python pipeline.py --dir /datos/sap/ --source PHXX
  python pipeline.py --dir /datos/sap/ --reset-hash PHXX
  PG_DSN="host=server dbname=sap user=etl password=xxx" python pipeline.py --dir /datos/sap/
        """,
    )
    parser.add_argument("--dir",        required=True, help="Carpeta con los CSV de SAP")
    parser.add_argument("--source",     default=None,  help="Procesar solo esta fuente (ej: PHXX)")
    parser.add_argument("--dry-run",    action="store_true", help="Leer y validar sin escribir en BD")
    parser.add_argument("--skip-raw",   action="store_true", help="No cargar raw histórico")
    parser.add_argument("--reset-hash", default=None,  help="Forzar reprocesamiento de una fuente")
    parser.add_argument("--batch-id",   default=None,  help="ID externo del lote ETL")
    parser.add_argument("--batch-trigger", default="MANUAL", help="Origen del lote (MANUAL/WATCHER)")
    parser.add_argument("--batch-file", action="append", default=None, help="Archivo integrante del lote; repetir por cada archivo")
    args = parser.parse_args()

    if args.reset_hash:
        reset_file_hash(args.reset_hash)
    else:
        run(
            data_dir=args.dir,
            source_filter=args.source,
            dry_run=args.dry_run,
            skip_raw=args.skip_raw,
            batch_id=args.batch_id,
            batch_trigger=args.batch_trigger,
            batch_files=args.batch_file,
        )

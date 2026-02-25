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
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent))

from config.sources   import SOURCES, CATALOGS, PRODUCTO_SOURCES, FACT_LOAD_ORDER
from cleaners.transformers import TRANSFORMER_MAP, set_batch_id
from cleaners.transformers import transform_raw_ventas, transform_raw_clientes
from loaders.loader   import (
    get_connection, file_md5, read_csv,
    already_loaded, start_execution, finish_execution, log_reject,
    upsert_rows, upsert_catalog_v2, _merge_via_line_hash,
)
from parsers.parsers  import normalize_text, normalize_code, mock_code, pk_hash

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
        filepath = os.path.join(data_dir, src_cfg["file"])
        if not os.path.exists(filepath):
            logger.warning(f"  [cat] {src_key}: archivo no encontrado ({filepath})")
            continue

        # Leer todas las filas una vez
        rows = list(read_csv(filepath, src_cfg["encoding"], src_cfg["delimiter"]))

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
    filepath = os.path.join(data_dir, src_cfg["file"])
    if not os.path.exists(filepath):
        logger.warning(f"  CLIENTES.CSV no encontrado")
        return

    vendedores = {}
    for row in read_csv(filepath, src_cfg["encoding"], src_cfg["delimiter"]):
        # Vendedores
        cod = normalize_code(row.get("Cod.Vend") or "")
        nom = normalize_text(row.get("Nombre_vendedor") or "")
        if cod and cod not in vendedores:
            vendedores[cod] = {"cod_vendedor": cod, "nombre_vendedor": nom, "tipo": "VENDEDOR"}

        # Gerentes regionales
        cod_g = normalize_code(row.get("Cód.Ger.Reg.") or "")
        nom_g = normalize_text(row.get("Nombre Gte. Regional") or "")
        if cod_g and cod_g not in vendedores:
            vendedores[cod_g] = {"cod_vendedor": cod_g, "nombre_vendedor": nom_g, "tipo": "GERENTE"}

    logger.info(f"  {len(vendedores)} vendedores/gerentes")
    if dry_run:
        return

    # Agregar line_hash para el upsert genérico
    rows = []
    for v in vendedores.values():
        v["line_hash"] = pk_hash(v["cod_vendedor"])
        v["batch_id"]  = _BATCH_ID
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
        filepath = os.path.join(data_dir, src_cfg["file"])
        if not os.path.exists(filepath):
            continue

        for row in read_csv(filepath, src_cfg["encoding"], src_cfg["delimiter"]):
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
        p["line_hash"] = pk_hash(p["codigo_mat"])
        p["batch_id"]  = _BATCH_ID
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
    filepath = os.path.join(data_dir, src_cfg["file"])
    if not os.path.exists(filepath):
        logger.warning(f"  CLIENTES.CSV no encontrado")
        return

    from parsers.parsers import parse_date

    rows = []
    for row in read_csv(filepath, src_cfg["encoding"], src_cfg["delimiter"]):
        cod = normalize_code(row.get("Cod. Cliente") or "")
        if not cod:
            continue

        # Convertir cod_vendedor y cod_gerente a sus códigos limpios
        cod_vend   = normalize_code(row.get("Cod.Vend") or "")
        cod_gerente = normalize_code(row.get("Cód.Ger.Reg.") or "")

        clean = {
            "cod_cliente":            cod,
            "nombre_cliente":         normalize_text(row.get("Nombre sol.") or ""),
            "rif":                    normalize_code(row.get("RIF") or ""),
            "direccion":              normalize_text(row.get("Dirección") or ""),
            "telefono_fijo":          normalize_text(row.get("Telefono") or ""),
            "telefono_movil":         normalize_text(row.get("Teléfono móvil") or ""),
            "nombre_contacto":        normalize_text(row.get("Nombre persona conta") or ""),
            "poblacion":              normalize_text(row.get("Poblacion") or ""),
            "estado":                 normalize_text(row.get("Descrip. Estado") or ""),
            "moneda":                 normalize_code(row.get("Moneda") or ""),
            "cod_ruta_transporte":    normalize_code(row.get("Ruta Transp.") or ""),
            "fecha_creacion_cliente": parse_date(row.get("Fecha de creacion") or ""),
            "agente_retencion_flag":  _parse_bool(row.get("AG. RET.") or ""),
            "num_ultima_factura":     normalize_code(row.get("Ult.Fact") or ""),
            "fecha_ultima_factura":   parse_date(row.get("Fecha Fact") or ""),
            "num_ultimo_pago":        normalize_code(row.get("Doc.Ult.Pago") or ""),
            "fecha_ultimo_pago":      parse_date(row.get("Fecha Pago") or ""),
            # FKs a catálogos (solo el código)
            "cod_condicion_pago":     normalize_code(row.get("Cond. Pago") or ""),
            "cod_ramo":               normalize_code(row.get("Ramo") or ""),
            "cod_gpo_cliente":        normalize_code(row.get("Gr Clientes") or ""),
            "cod_zona_ventas":        normalize_code(row.get("Zona Ventas") or ""),
            "cod_grp_vendedor":       normalize_code(row.get("Grupo Vend.") or ""),
            "cod_lista_precio":       normalize_code(row.get("Lista") or ""),
            "cod_canal":              normalize_code(row.get("Canal") or ""),
            "cod_vendedor":           cod_vend  or None,
            "cod_gerente":            cod_gerente or None,
            "is_placeholder":         False,
            "is_active":              True,
            "line_hash":              pk_hash(cod),
            "batch_id":               _BATCH_ID,
        }
        rows.append(clean)

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
    src_cfg  = SOURCES.get("PHXX")
    if not src_cfg:
        return
    filepath = os.path.join(data_dir, src_cfg["file"])
    if not os.path.exists(filepath):
        return

    clientes_ventas = set()
    for row in read_csv(filepath, src_cfg["encoding"], src_cfg["delimiter"]):
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
            "line_hash":      pk_hash(cod, "placeholder"),
            "batch_id":       _BATCH_ID,
        })

    upsert_rows(conn, "dim", "cliente", placeholders,
                pk_columns=["cod_cliente"])


# ──────────────────────────────────────────────────────────────────
# PASO 5: Tablas de hechos
# ──────────────────────────────────────────────────────────────────

def load_fact(source_key: str, data_dir: str, dry_run: bool = False):
    """Carga una tabla de hechos usando el transformer correspondiente."""

    src_cfg = SOURCES.get(source_key)
    if not src_cfg:
        logger.error(f"[{source_key}] Fuente desconocida")
        return

    filepath = os.path.join(data_dir, src_cfg["file"])
    if not os.path.exists(filepath):
        logger.warning(f"[{source_key}] Archivo no encontrado: {filepath}")
        return

    transformer = TRANSFORMER_MAP.get(source_key)
    if not transformer:
        logger.warning(f"[{source_key}] Sin transformer, saltando")
        return

    schema, table = src_cfg["table"]
    fhash = file_md5(filepath)

    # Nivel 1 de idempotencia: mismo archivo → skip total
    if not dry_run:
        with get_connection(DSN) as conn:
            if already_loaded(conn, source_key, fhash):
                logger.info(f"[{source_key}] Sin cambios (mismo MD5) → skip")
                return
            exec_id = start_execution(conn, source_key, filepath, fhash)

    logger.info(f"[{source_key}] Procesando {os.path.basename(filepath)}")

    clean_rows = []
    rejected   = []
    row_num    = 0

    for raw_row in read_csv(filepath, src_cfg["encoding"], src_cfg["delimiter"]):
        row_num += 1
        result = transformer(raw_row)
        if result.is_valid:
            clean_rows.append(result.row)
        else:
            rejected.append((row_num, raw_row, "; ".join(result.errors)))

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

    except Exception as e:
        logger.error(f"[{source_key}] ERROR: {e}", exc_info=True)
        if not dry_run:
            with get_connection(DSN) as conn:
                finish_execution(conn, exec_id, "FAILED", error_msg=str(e))
        raise


# ──────────────────────────────────────────────────────────────────
# PASO 6: Raw histórico (PHXX y CLIENTES)
# ──────────────────────────────────────────────────────────────────

def load_raw(data_dir: str, dry_run: bool = False):
    """
    Guarda los CSV originales en raw.ventas y raw.clientes
    sin ninguna transformación.
    """
    logger.info("── PASO 6: Raw histórico ──────────────────────────")

    jobs = [
        ("PHXX",     "raw.ventas",   transform_raw_ventas),
        ("CLIENTES", "raw.clientes", transform_raw_clientes),
    ]

    for src_key, raw_table, transform_fn in jobs:
        src_cfg  = SOURCES.get(src_key)
        filepath = os.path.join(data_dir, src_cfg["file"])
        if not os.path.exists(filepath):
            logger.warning(f"  [{src_key}] no encontrado, saltando raw")
            continue

        logger.info(f"  [{src_key}] → {raw_table}")
        rows = []
        source_file = os.path.basename(filepath)

        for raw_row in read_csv(filepath, src_cfg["encoding"], src_cfg["delimiter"]):
            record = transform_fn(raw_row, source_file, _BATCH_ID)
            rows.append(record)

        logger.info(f"  [{src_key}] {len(rows)} filas raw")
        if dry_run or not rows:
            continue

        schema, table = raw_table.split(".")
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
            import psycopg2.extras
            values = [[r.get(c) for c in cols] for r in rows]
            with conn.cursor() as cur:
                psycopg2.extras.execute_values(cur, sql, values, page_size=500)
                affected = cur.rowcount
            logger.info(f"  [{src_key}] raw: {affected} procesados")


# ──────────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────────

_BATCH_ID = str(uuid.uuid4())


def run(
    data_dir:      str,
    source_filter: Optional[str] = None,
    dry_run:       bool = False,
    skip_raw:      bool = False,
):
    set_batch_id(_BATCH_ID)

    logger.info("=" * 60)
    logger.info(f"ETL Pipeline  batch={_BATCH_ID[:8]}")
    logger.info(f"dir={data_dir}  dry_run={dry_run}")
    logger.info("=" * 60)

    if source_filter:
        # Modo foco: cargar solo una fuente específica
        logger.info(f"Modo foco: procesando solo {source_filter}")
        load_fact(source_filter, data_dir, dry_run)
        return

    # Orden obligatorio: dims primero, luego hechos
    load_catalogs(data_dir, dry_run)
    load_dim_vendedor(data_dir, dry_run)
    load_dim_producto(data_dir, dry_run)
    load_dim_cliente(data_dir, dry_run)

    for source_key in FACT_LOAD_ORDER:
        load_fact(source_key, data_dir, dry_run)

    if not skip_raw:
        load_raw(data_dir, dry_run)

    logger.info("=" * 60)
    logger.info("Pipeline completado.")
    logger.info("=" * 60)


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
    args = parser.parse_args()

    if args.reset_hash:
        reset_file_hash(args.reset_hash)
    else:
        run(
            data_dir=args.dir,
            source_filter=args.source,
            dry_run=args.dry_run,
            skip_raw=args.skip_raw,
        )

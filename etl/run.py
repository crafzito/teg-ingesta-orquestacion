import argparse
import logging
import time
import uuid

from etl.config import load_config
from etl.db.connection import get_connection, transaction
from etl.db.schema_manager import initialize_database
from etl.extract.csv_reader import CSVReader
from etl.load.clean_loader import load_clean_clientes, load_clean_ventas
from etl.load.dimension_loader import upsert_all_dimensions
from etl.load.fact_loader import upsert_fact_venta_linea
from etl.load.raw_loader import load_raw_clientes, load_raw_ventas
from etl.quality.enrichment import enrich_csv
from etl.quality.metrics import collect_batch_metrics, write_metrics
from etl.quality.validators import (
    log_rejections_bulk,
    log_warnings_bulk,
    validate_clientes_row,
    validate_ventas_row,
)
from etl.transform.catalog_resolver import CatalogResolver
from etl.transform.cleaner import ClientesCleaner, VentasCleaner

logger = logging.getLogger("etl")


def setup_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


def register_batch(conn, batch_id: str, clientes_file: str, ventas_file: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO core.etl_batch (batch_id, clientes_file, ventas_file)
               VALUES (%s, %s, %s)
               ON CONFLICT (batch_id) DO UPDATE SET
                   started_at = NOW(), status = 'RUNNING',
                   clientes_file = EXCLUDED.clientes_file,
                   ventas_file = EXCLUDED.ventas_file,
                   error_message = NULL, finished_at = NULL""",
            (batch_id, clientes_file, ventas_file),
        )
    conn.commit()


def finalize_batch(conn, batch_id: str, status: str, error_msg: str | None = None) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """UPDATE core.etl_batch
               SET status = %s, finished_at = NOW(), error_message = %s
               WHERE batch_id = %s""",
            (status, error_msg, batch_id),
        )
    conn.commit()


def cleanup_batch_data(conn, batch_id: str) -> None:
    """Limpia todos los datos previos de un batch_id para permitir re-ejecucion."""
    tables = [
        "DELETE FROM core.fact_venta_linea WHERE batch_id = %s",
        "DELETE FROM core.etl_metrics WHERE batch_id = %s",
        "DELETE FROM core.etl_warnings WHERE batch_id = %s",
        "DELETE FROM core.etl_rejects WHERE batch_id = %s",
        "DELETE FROM staging.stg_ventas_clean WHERE _batch_id = %s",
        "DELETE FROM staging.stg_clientes_clean WHERE _batch_id = %s",
        "DELETE FROM staging.stg_ventas_raw WHERE _batch_id = %s",
        "DELETE FROM staging.stg_clientes_raw WHERE _batch_id = %s",
    ]
    with conn.cursor() as cur:
        for sql in tables:
            cur.execute(sql, (batch_id,))
            if cur.rowcount > 0:
                table_name = sql.split("FROM ")[1].split(" WHERE")[0]
                logger.info("  Limpiado %s: %d filas", table_name, cur.rowcount)
    conn.commit()


def ensure_partitions(conn, ventas_rows: list[dict]) -> None:
    """Crea particiones mensuales faltantes segun las fechas en ventas."""
    months_needed: set[tuple[int, int]] = set()
    for row in ventas_rows:
        fecha = row.get("fecha_doc")
        if fecha is not None:
            months_needed.add((fecha.year, fecha.month))

    if not months_needed:
        return

    with conn.cursor() as cur:
        cur.execute("""
            SELECT inhrelid::regclass::text
            FROM pg_inherits
            WHERE inhparent = 'core.fact_venta_linea'::regclass
        """)
        existing = {r[0] for r in cur.fetchall()}

    created = 0
    for year, month in sorted(months_needed):
        part_name = f"core.fact_venta_linea_y{year}m{month:02d}"
        if part_name in existing:
            continue
        next_month = month + 1
        next_year = year
        if next_month > 12:
            next_month = 1
            next_year = year + 1
        from_date = f"{year}-{month:02d}-01"
        to_date = f"{next_year}-{next_month:02d}-01"
        with conn.cursor() as cur:
            cur.execute(f"""
                CREATE TABLE IF NOT EXISTS {part_name}
                PARTITION OF core.fact_venta_linea
                FOR VALUES FROM ('{from_date}') TO ('{to_date}')
            """)
        created += 1
        logger.info("  Particion creada: %s", part_name)

    if created > 0:
        conn.commit()
        logger.info("  %d particiones nuevas creadas", created)


def run_pipeline(
    ventas_path: str,
    batch_id: str,
    clientes_path: str | None = None,
    skip_ddl: bool = False,
    enrich_output: str | None = None,
    env_path: str | None = None,
) -> None:
    config = load_config(env_path)
    setup_logging(config.log_level)
    conn = get_connection(config)
    start_time = time.time()
    has_clientes = clientes_path is not None

    try:
        # Paso 0: DDL
        if not skip_ddl:
            logger.info("=== Paso 0: Inicializando esquema ===")
            initialize_database(conn, config.sql_dir)

        # Paso 1: Registrar lote
        logger.info("=== Paso 1: Registrando lote %s ===", batch_id)
        register_batch(conn, batch_id, clientes_path, ventas_path)

        # Paso 1b: Limpiar datos previos del mismo batch (idempotencia)
        logger.info("=== Paso 1b: Limpiando datos previos del batch ===")
        cleanup_batch_data(conn, batch_id)

        # Paso 2: Extraer CSV
        logger.info("=== Paso 2: Extrayendo CSVs ===")
        clientes_header = []
        clientes_raw = []
        if has_clientes:
            clientes_reader = CSVReader(clientes_path)
            clientes_header = clientes_reader.read_header()
            clientes_raw = list(clientes_reader.read_rows())
        ventas_reader = CSVReader(ventas_path)
        ventas_raw = list(ventas_reader.read_rows())
        logger.info("Clientes: %d filas, Ventas: %d filas", len(clientes_raw), len(ventas_raw))

        # Paso 3: Cargar raw
        logger.info("=== Paso 3: Cargando staging raw ===")
        with transaction(conn):
            if has_clientes:
                load_raw_clientes(conn, clientes_raw, batch_id, config.batch_size)
            load_raw_ventas(conn, ventas_raw, batch_id, config.batch_size)

        # Paso 4: Limpiar y validar
        logger.info("=== Paso 4: Limpiando y validando ===")
        cli_cleaner = ClientesCleaner()
        ven_cleaner = VentasCleaner()

        clientes_clean = []
        clientes_warnings = []
        clientes_rejected = 0
        clientes_rejections = []
        for row_num, raw_values in clientes_raw:
            cleaned, warns = cli_cleaner.clean_row(clientes_header, raw_values)
            is_valid, issues = validate_clientes_row(cleaned)
            if warns:
                clientes_warnings.append((row_num, warns))
            if not is_valid:
                clientes_rejected += 1
                clientes_rejections.append((row_num, cleaned, issues))
            else:
                clientes_clean.append((row_num, cleaned))

        ventas_clean = []
        ventas_warnings = []
        ventas_rejected = 0
        ventas_rejections = []
        for row_num, raw_values in ventas_raw:
            cleaned, warns = ven_cleaner.clean_row(raw_values)
            cleaned["_row_number"] = row_num
            is_valid, issues = validate_ventas_row(cleaned)
            if warns:
                ventas_warnings.append((row_num, warns))
            if not is_valid:
                ventas_rejected += 1
                ventas_rejections.append((row_num, cleaned, issues))
            else:
                ventas_clean.append((row_num, cleaned))

        # Insertar rechazos en batch (una sola transaccion)
        if clientes_rejections or ventas_rejections:
            with transaction(conn):
                log_rejections_bulk(conn, batch_id, "clientes", clientes_rejections)
                log_rejections_bulk(conn, batch_id, "ventas", ventas_rejections)

        logger.info(
            "Clientes: %d limpios, %d rechazados. Ventas: %d limpios, %d rechazados",
            len(clientes_clean), clientes_rejected, len(ventas_clean), ventas_rejected,
        )

        # Paso 5: Cargar clean + warnings
        logger.info("=== Paso 5: Cargando staging clean ===")
        with transaction(conn):
            if has_clientes:
                load_clean_clientes(conn, clientes_clean, batch_id, config.batch_size)
            load_clean_ventas(conn, ventas_clean, batch_id, config.batch_size)
            if has_clientes:
                log_warnings_bulk(conn, batch_id, "clientes", clientes_warnings)
            log_warnings_bulk(conn, batch_id, "ventas", ventas_warnings)

        # Extraer dicts para las fases siguientes
        cli_dicts = [d for _, d in clientes_clean]
        ven_dicts = [d for _, d in ventas_clean]

        # Paso 6: Resolver catalogos
        logger.info("=== Paso 6: Resolviendo catalogos ===")
        with transaction(conn):
            resolver = CatalogResolver(conn)
            resolver.resolve_clientes_catalogs(cli_dicts, batch_id)
            resolver.resolve_ventas_catalogs(ven_dicts, batch_id)
            resolver.resolve_condicion_pago(cli_dicts, ven_dicts, batch_id)
            resolver.resolve_moneda(cli_dicts, ven_dicts, batch_id)

        # Paso 7: Upsert dimensiones
        logger.info("=== Paso 7: Upsert dimensiones ===")
        with transaction(conn):
            dim_results = upsert_all_dimensions(conn, cli_dicts, ven_dicts, batch_id)
            for table, count in dim_results.items():
                logger.info("  %s: %d", table, count)

        # Paso 7b: Garantizar particiones para las fechas del lote
        logger.info("=== Paso 7b: Verificando particiones ===")
        ensure_partitions(conn, ven_dicts)

        # Paso 8: Upsert fact
        logger.info("=== Paso 8: Upsert fact_venta_linea ===")
        with transaction(conn):
            fact_count = upsert_fact_venta_linea(conn, ven_dicts, batch_id, config.batch_size)

        # Paso 9: Metricas
        logger.info("=== Paso 9: Calculando metricas ===")
        elapsed = time.time() - start_time
        with transaction(conn):
            metrics = collect_batch_metrics(conn, batch_id)
            metrics["duration_seconds"] = round(elapsed, 2)
            write_metrics(conn, batch_id, metrics)

        # Paso 10: CSV enriquecido (opcional)
        if enrich_output:
            logger.info("=== Paso 10: Generando CSV enriquecido ===")
            enrich_csv(conn, ventas_path, enrich_output, batch_id, ven_dicts)

        # Finalizar lote
        finalize_batch(conn, batch_id, "COMPLETED")
        logger.info("=== Pipeline completado en %.1f segundos ===", elapsed)

        # Imprimir resumen
        print(f"\n{'='*60}")
        print(f"  LOTE: {batch_id}")
        print(f"  ESTADO: COMPLETED")
        print(f"  DURACION: {elapsed:.1f}s")
        for k, v in sorted(metrics.items()):
            print(f"  {k}: {v}")
        print(f"{'='*60}\n")

    except Exception as e:
        logger.error("Pipeline fallido: %s", e, exc_info=True)
        try:
            finalize_batch(conn, batch_id, "FAILED", str(e))
        except Exception:
            pass
        raise
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="ETL Pipeline: CSV -> PostgreSQL (clientes + ventas)",
    )
    parser.add_argument("--clientes", default=None, help="Ruta al CSV de clientes (opcional, tabla maestra)")
    parser.add_argument("--ventas", required=True, help="Ruta al CSV de ventas")
    parser.add_argument("--batch-id", default=None, help="ID del lote (auto-genera UUID si no se indica)")
    parser.add_argument("--skip-ddl", action="store_true", help="Omitir creacion de esquema")
    parser.add_argument("--enrich-output", default=None, help="Ruta para CSV enriquecido de ventas")
    parser.add_argument("--env", default=None, help="Ruta al archivo .env")

    args = parser.parse_args()
    batch_id = args.batch_id or f"batch_{uuid.uuid4().hex[:12]}"

    run_pipeline(
        ventas_path=args.ventas,
        batch_id=batch_id,
        clientes_path=args.clientes,
        skip_ddl=args.skip_ddl,
        enrich_output=args.enrich_output,
        env_path=args.env,
    )


if __name__ == "__main__":
    main()

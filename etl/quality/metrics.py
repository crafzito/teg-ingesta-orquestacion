import logging

from psycopg2.extras import execute_values

logger = logging.getLogger(__name__)


def collect_batch_metrics(conn, batch_id: str) -> dict[str, float]:
    metrics = {}
    queries = {
        "rows_raw_clientes": "SELECT COUNT(*) FROM staging.stg_clientes_raw WHERE _batch_id = %s",
        "rows_raw_ventas": "SELECT COUNT(*) FROM staging.stg_ventas_raw WHERE _batch_id = %s",
        "rows_clean_clientes": "SELECT COUNT(*) FROM staging.stg_clientes_clean WHERE _batch_id = %s",
        "rows_clean_ventas": "SELECT COUNT(*) FROM staging.stg_ventas_clean WHERE _batch_id = %s",
        "rows_fact": "SELECT COUNT(*) FROM core.fact_venta_linea WHERE batch_id = %s",
        "rows_rejected": "SELECT COUNT(*) FROM core.etl_rejects WHERE batch_id = %s",
        "rows_warned": "SELECT COUNT(*) FROM core.etl_warnings WHERE batch_id = %s",
        "dim_cliente_count": "SELECT COUNT(*) FROM core.dim_cliente",
        "dim_cliente_placeholders": "SELECT COUNT(*) FROM core.dim_cliente WHERE is_placeholder = TRUE",
        "dim_producto_count": "SELECT COUNT(*) FROM core.dim_producto",
        "dim_vendedor_count": "SELECT COUNT(*) FROM core.dim_vendedor",
    }

    with conn.cursor() as cur:
        for name, sql in queries.items():
            if "%s" in sql:
                cur.execute(sql, (batch_id,))
            else:
                cur.execute(sql)
            metrics[name] = float(cur.fetchone()[0])

    return metrics


def write_metrics(conn, batch_id: str, metrics: dict[str, float]) -> None:
    if not metrics:
        return
    data = [(batch_id, name, value) for name, value in metrics.items()]
    sql = """
        INSERT INTO core.etl_metrics (batch_id, metric_name, metric_value)
        VALUES %s
    """
    with conn.cursor() as cur:
        execute_values(cur, sql, data)
    logger.info("Metricas escritas: %d", len(data))

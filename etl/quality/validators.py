import json
import logging

from psycopg2.extras import execute_values

from etl.constants import UNKNOWN

logger = logging.getLogger(__name__)


def validate_clientes_row(row: dict) -> tuple[bool, list[str]]:
    issues = []
    cod = row.get("cod_cliente", "")
    if not cod or cod == UNKNOWN:
        issues.append("cod_cliente vacio o UNKNOWN")

    fecha_creacion = row.get("fecha_creacion_cliente")
    if fecha_creacion is None:
        issues.append("fecha_creacion_cliente no parseada")

    return len(issues) == 0, issues


def validate_ventas_row(row: dict) -> tuple[bool, list[str]]:
    issues = []

    fecha_doc = row.get("fecha_doc")
    if fecha_doc is None:
        issues.append("fecha_doc no parseada")
        return False, issues

    cod_cli = row.get("cod_cliente", "")
    if not cod_cli or cod_cli == UNKNOWN:
        issues.append("cod_cliente vacio")

    num_factura = row.get("num_factura", "")
    if not num_factura or num_factura == UNKNOWN:
        issues.append("num_factura vacio")

    return len(issues) == 0, issues


def _safe_json(row_data: dict) -> str:
    safe_data = {}
    for k, v in row_data.items():
        try:
            json.dumps(v, default=str)
            safe_data[k] = v
        except (TypeError, ValueError):
            safe_data[k] = str(v)
    return json.dumps(safe_data, default=str)


def log_rejections_bulk(conn, batch_id: str, table_source: str,
                        rejections: list[tuple[int, dict, list[str]]]) -> None:
    """Inserta todos los rechazos de una tabla en una sola operacion."""
    if not rejections:
        return
    data = []
    for row_num, row_data, reasons in rejections:
        data.append((batch_id, table_source, row_num, _safe_json(row_data), reasons))
    sql = """
        INSERT INTO core.etl_rejects (batch_id, table_source, row_number, row_data, reasons)
        VALUES %s
    """
    with conn.cursor() as cur:
        execute_values(cur, sql, data)
    logger.info("etl_rejects (%s): %d rechazos insertados", table_source, len(data))


def log_warnings_bulk(conn, batch_id: str, table_source: str,
                      warnings_list: list[tuple[int, list[str]]]) -> None:
    if not warnings_list:
        return
    data = []
    for row_num, warns in warnings_list:
        for w in warns:
            data.append((batch_id, table_source, row_num, None, w))
    if data:
        sql = """
            INSERT INTO core.etl_warnings (batch_id, table_source, row_number, field_name, message)
            VALUES %s
        """
        with conn.cursor() as cur:
            execute_values(cur, sql, data)

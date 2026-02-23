import logging
from datetime import date, datetime
from decimal import Decimal

from psycopg2.extras import execute_values

logger = logging.getLogger(__name__)

# Columnas de stg_clientes_clean (sin _batch_id, _row_number, _loaded_at)
_CLIENTES_CLEAN_COLS = [
    "cod_cliente", "nombre_cliente", "cod_condicion_pago", "desc_condicion_pago",
    "cod_ramo_cliente", "desc_ramo_cliente", "cod_grupo_cliente", "desc_grupo_cliente",
    "direccion", "telefono_fijo", "rif", "cod_ruta_transporte", "poblacion",
    "cod_zona_ventas", "desc_zona_ventas", "cod_grupo_vendedor", "desc_grupo_vendedor",
    "estado", "fecha_creacion_cliente", "agente_retencion_flag",
    "num_ultima_factura", "fecha_ultima_factura", "num_ultimo_pago", "fecha_ultimo_pago",
    "nombre_contacto", "telefono_movil_contacto", "cod_vendedor", "nombre_vendedor",
    "cod_gerente_regional", "nombre_gerente_regional", "cod_moneda",
    "cod_lista_precio_cliente", "desc_lista_precio_cliente", "cod_canal_cliente",
    "fecha_corte_archivo", "dias_sin_facturar",
]

# Columnas de stg_ventas_clean
_VENTAS_CLEAN_COLS = [
    "line_hash", "razon_social", "gpo_cliente", "clase_doc", "num_factura",
    "sector", "canal", "fecha_doc", "zona_vtas", "almacen",
    "denominacion_material", "cantidad_umv", "um_vtas", "cantidad_umb", "um_base",
    "prec_unitario", "monto_neto", "iva", "importe_final",
    "doc_comercial", "cond_pago", "fec_venc", "moneda_doc", "status_anulacion",
    "grp_vend", "vendedor", "referencia", "pedido_vta",
    "jerarquia_1", "jerarquia_2", "jerarquia_3",
    "um_peso", "peso_fact", "um_peso_gen",
    "ramo", "gr_material", "gr_articulo", "tipo_cambio",
    "mes", "ejercicio",
    "prec_unitario_2", "monto_neto_2", "iva_2", "importe_final_2",
    "conc_busq", "codigo_mat", "listas_precios",
    "cod_cliente", "cod_lista_precio_origen",
    "ind_retcl", "ind_auto_retcl", "fechahora",
    "cod_mot", "tx_motivo", "cod_vend",
]


def _adapt_value(val):
    if val is None:
        return None
    if isinstance(val, (date, datetime, Decimal, int, bool)):
        return val
    return str(val)


def load_clean_clientes(
    conn, cleaned_rows: list[tuple[int, dict]], batch_id: str, batch_size: int = 1000
) -> int:
    if not cleaned_rows:
        return 0

    all_cols = ["_batch_id", "_row_number"] + _CLIENTES_CLEAN_COLS
    cols_sql = ", ".join(all_cols)
    template = "(" + ", ".join(["%s"] * len(all_cols)) + ")"

    data = []
    for row_num, row_dict in cleaned_rows:
        values = [batch_id, row_num]
        for col in _CLIENTES_CLEAN_COLS:
            values.append(_adapt_value(row_dict.get(col)))
        data.append(tuple(values))

    with conn.cursor() as cur:
        for i in range(0, len(data), batch_size):
            batch = data[i:i + batch_size]
            execute_values(
                cur,
                f"INSERT INTO staging.stg_clientes_clean ({cols_sql}) VALUES %s",
                batch,
                template=template,
            )

    logger.info("stg_clientes_clean: %d filas cargadas", len(data))
    return len(data)


def load_clean_ventas(
    conn, cleaned_rows: list[tuple[int, dict]], batch_id: str, batch_size: int = 1000
) -> int:
    if not cleaned_rows:
        return 0

    all_cols = ["_batch_id", "_row_number"] + _VENTAS_CLEAN_COLS
    cols_sql = ", ".join(all_cols)
    template = "(" + ", ".join(["%s"] * len(all_cols)) + ")"

    data = []
    for row_num, row_dict in cleaned_rows:
        values = [batch_id, row_num]
        for col in _VENTAS_CLEAN_COLS:
            values.append(_adapt_value(row_dict.get(col)))
        data.append(tuple(values))

    with conn.cursor() as cur:
        for i in range(0, len(data), batch_size):
            batch = data[i:i + batch_size]
            execute_values(
                cur,
                f"INSERT INTO staging.stg_ventas_clean ({cols_sql}) VALUES %s",
                batch,
                template=template,
            )

    logger.info("stg_ventas_clean: %d filas cargadas", len(data))
    return len(data)

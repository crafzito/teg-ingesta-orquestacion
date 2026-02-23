import json
import logging

from psycopg2.extras import execute_values

from etl.constants import CLIENTES_COLUMN_MAP, VENTAS_COLUMNS_BY_INDEX

logger = logging.getLogger(__name__)

# Columnas raw de clientes (en orden del COLUMN_MAP)
_CLIENTES_RAW_COLS = [
    "col_cod_cliente", "col_nombre_sol", "col_cond_pago", "col_desc_cond_pag",
    "col_ramo", "col_desc_ramo", "col_gr_clientes", "col_desc_gr_clien",
    "col_direccion", "col_telefono", "col_rif", "col_ruta_transp",
    "col_poblacion", "col_zona_ventas", "col_desc_zona", "col_grupo_vend",
    "col_desc_grupo_ve", "col_descrip_estado", "col_fecha_creacion", "col_ag_ret",
    "col_ult_fact", "col_fecha_fact", "col_doc_ult_pago", "col_fecha_pago",
    "col_nombre_contacto", "col_telefono_movil", "col_cod_vend", "col_nombre_vendedor",
    "col_cod_ger_reg", "col_nombre_gte_regional", "col_moneda", "col_lista",
    "col_denominacion", "col_canal", "col_fecha_actual", "col_dias_ult_fact",
]

# Columnas raw de ventas
_VENTAS_RAW_COLS = [
    "col_razon_social", "col_gpo_cliente", "col_clase_doc", "col_num_factura",
    "col_sector", "col_canal", "col_fecha_doc", "col_zona_vtas",
    "col_almacen", "col_denominacion_material", "col_cantidad_umv", "col_um_vtas",
    "col_cantidad_umb", "col_um_base", "col_prec_unitario", "col_monto_neto",
    "col_iva", "col_importe_final", "col_doc_comercial", "col_cond_pago",
    "col_fec_venc", "col_moneda_doc", "col_status_anulacion", "col_doc_anulac",
    "col_grp_vend", "col_vendedor", "col_referencia", "col_pedido_vta",
    "col_jerarquia_1", "col_jerarquia_2", "col_jerarquia_3", "col_um_peso",
    "col_peso_fact", "col_peso_total", "col_um_peso_gen", "col_ramo",
    "col_gr_material", "col_gr_articulo", "col_tipo_cambio", "col_mes",
    "col_ejercicio", "col_prec_unitario_2", "col_monto_neto_2", "col_iva_2",
    "col_importe_final_2", "col_conc_busq", "col_codigo_mat", "col_listas_precios",
    "col_empty_49", "col_cod_cliente", "col_cod_lista_precio_origen",
    "col_ind_retcl", "col_ind_auto_retcl", "col_fechahora",
    "col_cod_mot", "col_tx_motivo", "col_cod_vend",
]


def load_raw_clientes(conn, rows: list[tuple[int, list[str]]], batch_id: str, batch_size: int = 1000) -> int:
    if not rows:
        return 0

    cols = ", ".join(["_batch_id", "_row_number"] + _CLIENTES_RAW_COLS)
    template = "(" + ", ".join(["%s"] * (2 + len(_CLIENTES_RAW_COLS))) + ")"

    data = []
    for row_num, values in rows:
        padded = values + [""] * max(0, 36 - len(values))
        data.append((batch_id, row_num, *padded[:36]))

    with conn.cursor() as cur:
        for i in range(0, len(data), batch_size):
            batch = data[i:i + batch_size]
            execute_values(
                cur,
                f"INSERT INTO staging.stg_clientes_raw ({cols}) VALUES %s",
                batch,
                template=template,
            )

    logger.info("stg_clientes_raw: %d filas cargadas", len(data))
    return len(data)


def load_raw_ventas(conn, rows: list[tuple[int, list[str]]], batch_id: str, batch_size: int = 1000) -> int:
    if not rows:
        return 0

    cols = ", ".join(["_batch_id", "_row_number"] + _VENTAS_RAW_COLS)
    template = "(" + ", ".join(["%s"] * (2 + len(_VENTAS_RAW_COLS))) + ")"

    data = []
    for row_num, values in rows:
        padded = values + [""] * max(0, 57 - len(values))
        data.append((batch_id, row_num, *padded[:57]))

    with conn.cursor() as cur:
        for i in range(0, len(data), batch_size):
            batch = data[i:i + batch_size]
            execute_values(
                cur,
                f"INSERT INTO staging.stg_ventas_raw ({cols}) VALUES %s",
                batch,
                template=template,
            )

    logger.info("stg_ventas_raw: %d filas cargadas", len(data))
    return len(data)

import logging
from datetime import date, datetime
from decimal import Decimal

from psycopg2.extras import execute_values

from etl.constants import CATALOG_DOMAINS, UNKNOWN
from etl.transform.parsers import normalize_text_upper

logger = logging.getLogger(__name__)


def _build_dim_lookup(conn, table: str, key_col: str, id_col: str) -> dict[str, int]:
    sql = f"SELECT {key_col}, {id_col} FROM core.{table}"
    with conn.cursor() as cur:
        cur.execute(sql)
        return {str(row[0]): row[1] for row in cur.fetchall()}



def _adapt(val):
    if val is None:
        return None
    if isinstance(val, (date, datetime, Decimal, int, float, bool)):
        return val
    s = str(val).strip()
    return s if s and s != UNKNOWN else None


def upsert_fact_venta_linea(conn, ventas_rows: list[dict], batch_id: str, batch_size: int = 1000) -> int:
    if not ventas_rows:
        return 0

    # Cargar lookups de dimensiones
    cliente_lk = _build_dim_lookup(conn, "dim_cliente", "cod_cliente", "dim_cliente_id")
    producto_lk = _build_dim_lookup(conn, "dim_producto", "codigo_mat", "dim_producto_id")
    vendedor_lk = _build_dim_lookup(conn, "dim_vendedor", "cod_vendedor", "dim_vendedor_id")
    condpago_lk = _build_dim_lookup(conn, "dim_condicion_pago", "cod_condicion_pago", "dim_condicion_pago_id")
    # Mapa desc normalizada -> codigo oficial para resolver cond_pago de ventas
    condpago_desc_to_code: dict[str, str] = {}
    with conn.cursor() as cur:
        cur.execute("SELECT valor_normalizado, codigo_generado FROM core.map_catalogo_valor WHERE dominio = 'condicion_pago'")
        for val_norm, codigo in cur.fetchall():
            condpago_desc_to_code[val_norm] = codigo
    moneda_lk = _build_dim_lookup(conn, "dim_moneda", "cod_moneda", "dim_moneda_id")

    # Lookups de catalogos (por codigo)
    cat_lookups: dict[str, dict[str, int]] = {}
    for domain, info in CATALOG_DOMAINS.items():
        table = info["table"]
        id_col = f"{table}_id"
        sql = f"SELECT codigo, {id_col} FROM core.{table}"
        with conn.cursor() as cur:
            cur.execute(sql)
            cat_lookups[domain] = {str(r[0]): r[1] for r in cur.fetchall()}

    # Construir mapa de valor normalizado -> codigo para catalogos
    val_to_code: dict[str, dict[str, str]] = {}
    with conn.cursor() as cur:
        cur.execute("SELECT dominio, valor_normalizado, codigo_generado FROM core.map_catalogo_valor")
        for dominio, val_norm, codigo in cur.fetchall():
            if dominio not in val_to_code:
                val_to_code[dominio] = {}
            val_to_code[dominio][val_norm] = codigo

    def resolve_catalog_fk(domain: str, raw_value) -> int | None:
        if raw_value is None:
            return None
        text = str(raw_value).strip()
        if not text or text == UNKNOWN:
            norm = UNKNOWN
        else:
            norm = normalize_text_upper(text)
        code = val_to_code.get(domain, {}).get(norm)
        if code:
            return cat_lookups.get(domain, {}).get(code)
        return None

    # Preparar datos del fact
    columns = [
        "line_hash", "batch_id",
        "dim_cliente_id", "dim_producto_id", "dim_vendedor_id",
        "dim_condicion_pago_id", "dim_moneda_id",
        "dim_gpo_cliente_id", "dim_clase_doc_id", "dim_sector_id",
        "dim_canal_id", "dim_zona_ventas_id", "dim_doc_comercial_id",
        "dim_grp_vend_id", "dim_ramo_id", "dim_gr_material_id",
        "dim_gr_articulo_id", "dim_lista_precio_id", "dim_tx_motivo_id",
        "num_factura", "referencia", "pedido_vta", "almacen", "conc_busq",
        "cod_lista_precio_origen", "cod_mot", "status_anulacion",
        "ind_retcl", "ind_auto_retcl",
        "fecha_doc", "fec_venc", "fechahora",
        "cantidad_umv", "um_vtas", "cantidad_umb", "um_base",
        "prec_unitario", "monto_neto", "iva", "importe_final",
        "tipo_cambio", "prec_unitario_2", "monto_neto_2", "iva_2", "importe_final_2",
        "peso_fact", "um_peso", "um_peso_gen",
        "mes", "ejercicio", "_row_number",
    ]

    cols_sql = ", ".join(columns)
    template = "(" + ", ".join(["%s"] * len(columns)) + ")"

    data = []
    for row in ventas_rows:
        # Resolver FKs
        cod_cli = str(row.get("cod_cliente", "")).strip()
        cod_mat = str(row.get("codigo_mat", "")).strip()
        cod_vend = str(row.get("cod_vend", "")).strip()
        cond_pago_val = str(row.get("cond_pago", "")).strip()
        cond_pago_norm = normalize_text_upper(cond_pago_val) if cond_pago_val else UNKNOWN
        # Resolver descripcion -> codigo oficial via map_catalogo_valor
        cond_pago_code = condpago_desc_to_code.get(cond_pago_norm, cond_pago_norm)
        moneda_val = str(row.get("moneda_doc", "")).strip()

        values = [
            row.get("line_hash"),
            batch_id,
            cliente_lk.get(cod_cli),
            producto_lk.get(cod_mat),
            vendedor_lk.get(cod_vend),
            condpago_lk.get(cond_pago_code),
            moneda_lk.get(moneda_val),
            resolve_catalog_fk("gpo_cliente", row.get("gpo_cliente")),
            resolve_catalog_fk("clase_doc", row.get("clase_doc")),
            resolve_catalog_fk("sector", row.get("sector")),
            resolve_catalog_fk("canal", row.get("canal")),
            resolve_catalog_fk("zona_ventas", row.get("zona_vtas")),
            resolve_catalog_fk("doc_comercial", row.get("doc_comercial")),
            resolve_catalog_fk("grp_vend", row.get("grp_vend")),
            resolve_catalog_fk("ramo", row.get("ramo")),
            resolve_catalog_fk("gr_material", row.get("gr_material")),
            resolve_catalog_fk("gr_articulo", row.get("gr_articulo")),
            resolve_catalog_fk("lista_precio", row.get("listas_precios")),
            resolve_catalog_fk("tx_motivo", row.get("tx_motivo")),
            _adapt(row.get("num_factura")),
            _adapt(row.get("referencia")),
            _adapt(row.get("pedido_vta")),
            _adapt(row.get("almacen")),
            _adapt(row.get("conc_busq")),
            _adapt(row.get("cod_lista_precio_origen")),
            _adapt(row.get("cod_mot")),
            _adapt(row.get("status_anulacion")),
            _adapt(row.get("ind_retcl")),
            _adapt(row.get("ind_auto_retcl")),
            row.get("fecha_doc"),
            row.get("fec_venc"),
            row.get("fechahora"),
            row.get("cantidad_umv"),
            _adapt(row.get("um_vtas")),
            row.get("cantidad_umb"),
            _adapt(row.get("um_base")),
            row.get("prec_unitario"),
            row.get("monto_neto"),
            row.get("iva"),
            row.get("importe_final"),
            row.get("tipo_cambio"),
            row.get("prec_unitario_2"),
            row.get("monto_neto_2"),
            row.get("iva_2"),
            row.get("importe_final_2"),
            row.get("peso_fact"),
            _adapt(row.get("um_peso")),
            _adapt(row.get("um_peso_gen")),
            row.get("mes"),
            row.get("ejercicio"),
            row.get("_row_number"),
        ]
        data.append(tuple(values))

    # Dedup dentro del lote: conservar primera ocurrencia por (line_hash, fecha_doc)
    seen: set[tuple] = set()
    unique_data = []
    duplicates = 0
    for row_tuple in data:
        line_hash = row_tuple[0]   # line_hash es la primera columna
        fecha_doc = row_tuple[29]  # fecha_doc posicion en columns list
        key = (line_hash, fecha_doc)
        if key in seen:
            duplicates += 1
            continue
        seen.add(key)
        unique_data.append(row_tuple)

    if duplicates > 0:
        logger.warning("fact_venta_linea: %d filas duplicadas exactas descartadas", duplicates)

    sql = f"""
        INSERT INTO core.fact_venta_linea ({cols_sql})
        VALUES %s
        ON CONFLICT (line_hash, batch_id, fecha_doc) DO UPDATE SET
            dim_cliente_id = EXCLUDED.dim_cliente_id,
            dim_producto_id = EXCLUDED.dim_producto_id,
            importe_final = EXCLUDED.importe_final,
            _loaded_at = NOW()
    """

    with conn.cursor() as cur:
        for i in range(0, len(unique_data), batch_size):
            batch = unique_data[i:i + batch_size]
            execute_values(cur, sql, batch, template=template)

    logger.info("fact_venta_linea: %d filas upserted (%d duplicadas descartadas)", len(unique_data), duplicates)
    return len(unique_data)

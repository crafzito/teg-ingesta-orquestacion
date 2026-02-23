import logging

from psycopg2.extras import execute_values

from etl.constants import UNKNOWN

logger = logging.getLogger(__name__)


def upsert_dim_cliente(conn, clientes_rows: list[dict], batch_id: str) -> int:
    if not clientes_rows:
        return 0

    # Dedup por cod_cliente: ultimo gana (mayor row_number implicitamente)
    by_cod: dict[str, dict] = {}
    for row in clientes_rows:
        cod = row.get("cod_cliente", "")
        if cod and cod != UNKNOWN:
            by_cod[cod] = row

    # Campos que van a dim_cliente (sin descripciones que se derivan de catalogo)
    dim_fields = [
        "cod_cliente", "nombre_cliente",
        "cod_condicion_pago", "cod_ramo_cliente", "cod_grupo_cliente",
        "cod_zona_ventas", "cod_grupo_vendedor", "cod_vendedor",
        "cod_gerente_regional", "cod_moneda", "cod_lista_precio_cliente",
        "cod_canal_cliente",
        "direccion", "telefono_fijo", "rif", "cod_ruta_transporte", "poblacion",
        "estado", "fecha_creacion_cliente", "agente_retencion_flag",
        "num_ultima_factura", "fecha_ultima_factura",
        "num_ultimo_pago", "fecha_ultimo_pago",
        "nombre_contacto", "telefono_movil_contacto",
        "fecha_corte_archivo", "dias_sin_facturar",
    ]

    data = []
    for cod, row in by_cod.items():
        values = []
        for field in dim_fields:
            val = row.get(field)
            values.append(val)
        values.append(False)      # is_placeholder
        values.append(batch_id)   # _batch_id
        data.append(tuple(values))

    cols = dim_fields + ["is_placeholder", "_batch_id"]
    cols_sql = ", ".join(cols)
    update_parts = []
    for f in dim_fields:
        if f != "cod_cliente":
            update_parts.append(f"{f} = EXCLUDED.{f}")
    update_parts.append("is_placeholder = FALSE")
    update_parts.append("_batch_id = EXCLUDED._batch_id")
    update_parts.append("_updated_at = NOW()")
    update_sql = ", ".join(update_parts)

    template = "(" + ", ".join(["%s"] * len(cols)) + ")"

    sql = f"""
        INSERT INTO core.dim_cliente ({cols_sql})
        VALUES %s
        ON CONFLICT (cod_cliente) DO UPDATE SET {update_sql}
    """

    with conn.cursor() as cur:
        execute_values(cur, sql, data, template=template)

    logger.info("dim_cliente: %d clientes upserted", len(data))
    return len(data)


def create_placeholder_clients(conn, ventas_rows: list[dict], batch_id: str) -> int:
    ventas_codes = set()
    for row in ventas_rows:
        cod = row.get("cod_cliente", "")
        if isinstance(cod, str) and cod.strip() and cod.strip() != UNKNOWN:
            ventas_codes.add(cod.strip())

    if not ventas_codes:
        return 0

    # Buscar cuales ya existen
    with conn.cursor() as cur:
        cur.execute("SELECT cod_cliente FROM core.dim_cliente WHERE cod_cliente = ANY(%s)", (list(ventas_codes),))
        existing = {r[0] for r in cur.fetchall()}

    missing = ventas_codes - existing
    if not missing:
        return 0

    data = []
    for cod in missing:
        data.append((cod, f"PLACEHOLDER - {cod}", True, batch_id))

    sql = """
        INSERT INTO core.dim_cliente (cod_cliente, nombre_cliente, is_placeholder, _batch_id)
        VALUES %s
        ON CONFLICT (cod_cliente) DO NOTHING
    """
    with conn.cursor() as cur:
        execute_values(cur, sql, data)

    logger.info("dim_cliente: %d placeholders creados", len(data))
    return len(data)


def upsert_dim_producto(conn, ventas_rows: list[dict], batch_id: str) -> int:
    products: dict[str, dict] = {}
    for row in ventas_rows:
        cod_mat = row.get("codigo_mat", "")
        if isinstance(cod_mat, str) and cod_mat.strip() and cod_mat.strip() != UNKNOWN:
            cod_mat = cod_mat.strip()
            if cod_mat not in products:
                products[cod_mat] = {
                    "codigo_mat": cod_mat,
                    "denominacion_material": row.get("denominacion_material", UNKNOWN),
                    "jerarquia_1": row.get("jerarquia_1", UNKNOWN),
                    "jerarquia_2": row.get("jerarquia_2", UNKNOWN),
                    "jerarquia_3": row.get("jerarquia_3", UNKNOWN),
                    "sector": row.get("sector", UNKNOWN),
                    "gr_material": row.get("gr_material", UNKNOWN),
                    "gr_articulo": row.get("gr_articulo", UNKNOWN),
                }

    if not products:
        return 0

    data = [
        (p["codigo_mat"], p["denominacion_material"], p["jerarquia_1"],
         p["jerarquia_2"], p["jerarquia_3"], p["sector"],
         p["gr_material"], p["gr_articulo"], batch_id)
        for p in products.values()
    ]

    sql = """
        INSERT INTO core.dim_producto
            (codigo_mat, denominacion_material, jerarquia_1, jerarquia_2, jerarquia_3,
             sector, gr_material, gr_articulo, _batch_id)
        VALUES %s
        ON CONFLICT (codigo_mat) DO UPDATE SET
            denominacion_material = EXCLUDED.denominacion_material,
            jerarquia_1 = EXCLUDED.jerarquia_1,
            jerarquia_2 = EXCLUDED.jerarquia_2,
            jerarquia_3 = EXCLUDED.jerarquia_3,
            sector = EXCLUDED.sector,
            gr_material = EXCLUDED.gr_material,
            gr_articulo = EXCLUDED.gr_articulo,
            _batch_id = EXCLUDED._batch_id,
            _updated_at = NOW()
    """
    with conn.cursor() as cur:
        execute_values(cur, sql, data)

    logger.info("dim_producto: %d productos upserted", len(data))
    return len(data)


def upsert_dim_vendedor(conn, ventas_rows: list[dict], batch_id: str) -> int:
    vendedores: dict[str, str] = {}
    for row in ventas_rows:
        cod = row.get("cod_vend", "")
        nombre = row.get("vendedor", "")
        if isinstance(cod, str) and cod.strip() and cod.strip() != UNKNOWN:
            vendedores[cod.strip()] = nombre.strip() if isinstance(nombre, str) else UNKNOWN

    if not vendedores:
        return 0

    data = [(cod, nombre, batch_id) for cod, nombre in vendedores.items()]

    sql = """
        INSERT INTO core.dim_vendedor (cod_vendedor, nombre_vendedor, _batch_id)
        VALUES %s
        ON CONFLICT (cod_vendedor) DO UPDATE SET
            nombre_vendedor = EXCLUDED.nombre_vendedor,
            _batch_id = EXCLUDED._batch_id,
            _updated_at = NOW()
    """
    with conn.cursor() as cur:
        execute_values(cur, sql, data)

    logger.info("dim_vendedor: %d vendedores upserted", len(data))
    return len(data)


def upsert_all_dimensions(conn, clientes_rows: list[dict], ventas_rows: list[dict], batch_id: str) -> dict[str, int]:
    results = {}
    results["dim_cliente"] = upsert_dim_cliente(conn, clientes_rows, batch_id)
    results["dim_cliente_placeholders"] = create_placeholder_clients(conn, ventas_rows, batch_id)
    results["dim_producto"] = upsert_dim_producto(conn, ventas_rows, batch_id)
    results["dim_vendedor"] = upsert_dim_vendedor(conn, ventas_rows, batch_id)
    return results

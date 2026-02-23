UNKNOWN = "UNKNOWN"

# ============================================================
# Clientes: mapeo CSV header -> columna clean (snake_case)
# ============================================================
CLIENTES_COLUMN_MAP = {
    "Cod. Cliente":           "cod_cliente",
    "Nombre Sol.":            "nombre_cliente",
    "Cond. Pago":             "cod_condicion_pago",
    "Descripción Cond Pag":   "desc_condicion_pago",
    "Ramo":                   "cod_ramo_cliente",
    "Descripción Ramo":       "desc_ramo_cliente",
    "Gr Clientes":            "cod_grupo_cliente",
    "Descripción Gr Clien":   "desc_grupo_cliente",
    "Dirección":              "direccion",
    "Telefono":               "telefono_fijo",
    "RIF":                    "rif",
    "Ruta Transp.":           "cod_ruta_transporte",
    "Poblacion":              "poblacion",
    "Zona Ventas":            "cod_zona_ventas",
    "Descripción Zona":       "desc_zona_ventas",
    "Grupo Vend.":            "cod_grupo_vendedor",
    "Descripción Grupo Ve":   "desc_grupo_vendedor",
    "Descrip. Estado":        "estado",
    "Fecha de creacion":      "fecha_creacion_cliente",
    "AG. RET.":               "agente_retencion_flag",
    "Ult.Fact":               "num_ultima_factura",
    "Fecha Fact":             "fecha_ultima_factura",
    "Doc.Ult.Pago":           "num_ultimo_pago",
    "Fecha Pago":             "fecha_ultimo_pago",
    "Nombre persona conta":   "nombre_contacto",
    "Teléfono móvil":         "telefono_movil_contacto",
    "Cod.Vend":               "cod_vendedor",
    "Nombre_vendedor":        "nombre_vendedor",
    "Cód.Ger.Reg.":           "cod_gerente_regional",
    "Nombre Gte. Regional":   "nombre_gerente_regional",
    "Moneda":                 "cod_moneda",
    "Lista":                  "cod_lista_precio_cliente",
    "Denominacion":           "desc_lista_precio_cliente",
    "Canal":                  "cod_canal_cliente",
    "fecha actual":           "fecha_corte_archivo",
    "Dias ult fact":          "dias_sin_facturar",
}

# Campos de clientes que son descripciones derivables de un codigo FK
# Se mantienen en staging.clean pero NO van a core.dim_cliente
CLIENTES_DESC_FIELDS = {
    "desc_condicion_pago",
    "desc_ramo_cliente",
    "desc_grupo_cliente",
    "desc_zona_ventas",
    "desc_grupo_vendedor",
    "nombre_vendedor",
    "nombre_gerente_regional",
    "desc_lista_precio_cliente",
}

# ============================================================
# Ventas: mapeo por indice de columna CSV -> nombre clean
# (el CSV tiene 57 columnas, indices 0-56)
# ============================================================
VENTAS_COLUMNS_BY_INDEX = [
    "razon_social",             # 0
    "gpo_cliente",              # 1
    "clase_doc",                # 2
    "num_factura",              # 3
    "sector",                   # 4
    "canal",                    # 5
    "fecha_doc",                # 6
    "zona_vtas",                # 7
    "almacen",                  # 8
    "denominacion_material",    # 9
    "cantidad_umv",             # 10
    "um_vtas",                  # 11
    "cantidad_umb",             # 12
    "um_base",                  # 13
    "prec_unitario",            # 14
    "monto_neto",               # 15
    "iva",                      # 16
    "importe_final",            # 17
    "doc_comercial",            # 18
    "cond_pago",                # 19
    "fec_venc",                 # 20
    "moneda_doc",               # 21
    "status_anulacion",         # 22
    "doc_anulac",               # 23  (100% vacio - se ignora en clean)
    "grp_vend",                 # 24
    "vendedor",                 # 25
    "referencia",               # 26
    "pedido_vta",               # 27
    "jerarquia_1",              # 28
    "jerarquia_2",              # 29
    "jerarquia_3",              # 30
    "um_peso",                  # 31
    "peso_fact",                # 32
    "peso_total",               # 33  (100% vacio - se ignora en clean)
    "um_peso_gen",              # 34
    "ramo",                     # 35
    "gr_material",              # 36
    "gr_articulo",              # 37
    "tipo_cambio",              # 38
    "mes",                      # 39
    "ejercicio",                # 40
    "prec_unitario_2",          # 41
    "monto_neto_2",             # 42
    "iva_2",                    # 43
    "importe_final_2",          # 44
    "conc_busq",                # 45
    "codigo_mat",               # 46
    "listas_precios",           # 47
    "_empty_49",                # 48  (siempre vacio - se ignora)
    "cod_cliente",              # 49
    "cod_lista_precio_origen",  # 50  (col sin nombre, es codigo lista precio)
    "ind_retcl",                # 51
    "ind_auto_retcl",           # 52
    "fechahora",                # 53
    "cod_mot",                  # 54
    "tx_motivo",                # 55
    "cod_vend",                 # 56
]

# Columnas de ventas a ignorar en clean (siempre vacias)
VENTAS_SKIP_COLUMNS = {"_empty_49", "doc_anulac", "peso_total"}

# Campos monetarios de ventas (usan coma como decimal)
VENTAS_DECIMAL_FIELDS = {
    "prec_unitario", "monto_neto", "iva", "importe_final",
    "tipo_cambio",
    "prec_unitario_2", "monto_neto_2", "iva_2", "importe_final_2",
    "cantidad_umv", "cantidad_umb", "peso_fact",
}

# Campos de fecha en ventas
VENTAS_DATE_YYYYMMDD_FIELDS = {"fecha_doc", "fec_venc"}

# ============================================================
# Dominios de catalogo (ventas)
# Mapea nombre de dominio -> (campo en ventas clean, tabla dim)
# ============================================================
CATALOG_DOMAINS = {
    "gpo_cliente":   {"field": "gpo_cliente",    "table": "dim_gpo_cliente",    "prefix": "GPC"},
    "clase_doc":     {"field": "clase_doc",      "table": "dim_clase_doc",      "prefix": "CLD"},
    "sector":        {"field": "sector",         "table": "dim_sector",         "prefix": "SEC"},
    "canal":         {"field": "canal",          "table": "dim_canal",          "prefix": "CAN"},
    "zona_ventas":   {"field": "zona_vtas",      "table": "dim_zona_ventas",    "prefix": "ZVT"},
    "doc_comercial": {"field": "doc_comercial",  "table": "dim_doc_comercial",  "prefix": "DCO"},
    "grp_vend":      {"field": "grp_vend",       "table": "dim_grp_vend",       "prefix": "GRV"},
    "ramo":          {"field": "ramo",           "table": "dim_ramo",           "prefix": "RAM"},
    "gr_material":   {"field": "gr_material",    "table": "dim_gr_material",    "prefix": "GRM"},
    "gr_articulo":   {"field": "gr_articulo",    "table": "dim_gr_articulo",    "prefix": "GRA"},
    "lista_precio":  {"field": "listas_precios", "table": "dim_lista_precio",   "prefix": "LPR"},
    "tx_motivo":     {"field": "tx_motivo",      "table": "dim_tx_motivo",      "prefix": "TXM"},
}

# Pares codigo-descripcion en clientes que alimentan catalogos
# (el CSV de clientes tiene codigos oficiales que el de ventas no tiene)
CLIENTES_CATALOG_PAIRS = {
    "condicion_pago": {"code_field": "cod_condicion_pago", "desc_field": "desc_condicion_pago"},
    "ramo":           {"code_field": "cod_ramo_cliente",   "desc_field": "desc_ramo_cliente"},
    "gpo_cliente":    {"code_field": "cod_grupo_cliente",  "desc_field": "desc_grupo_cliente"},
    "zona_ventas":    {"code_field": "cod_zona_ventas",    "desc_field": "desc_zona_ventas"},
    "grp_vend":       {"code_field": "cod_grupo_vendedor", "desc_field": "desc_grupo_vendedor"},
    "lista_precio":   {"code_field": "cod_lista_precio_cliente", "desc_field": "desc_lista_precio_cliente"},
}

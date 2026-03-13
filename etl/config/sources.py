# ================================================================
# config/sources.py — Mapa centralizado de todas las fuentes CSV
# ================================================================
# Cada entrada define TODO lo necesario para procesar un archivo:
#   file          : nombre exacto del archivo CSV
#   encoding      : siempre latin-1 en SAP Venezuela
#   delimiter     : siempre ; en estos exports
#   pk_cols       : columnas que forman la PK de negocio (para UPSERT)
#   drop_cols     : columnas a descartar (redundantes, siempre vacías, etc.)
#   upsert_mode   : "merge" = INSERT+UPDATE | "snapshot" = TRUNCATE+INSERT
#   table         : (schema, tabla) destino en PostgreSQL
#   planta        : para tablas unificadas (ordenes, consumos)
#   es_mes_actual : para tabla pedidos unificada
#   tipo_inv      : para tabla inventario unificada
# ================================================================

SOURCES = {

    # ────────────────────────────────────────────────────────────
    # VENTAS — PHXX.CSV
    # PK: num_factura + cod_cliente + codigo_mat + fecha_doc
    # ────────────────────────────────────────────────────────────
    "PHXX": {
        "file":       "PHXX.CSV",
        "file_patterns": [
            r"PHXX\.CSV",
            r"PPXX\.CSV",
            r"AMXX\.CSV",
            r"EMPX(?:_\d+)?\.CSV", #eliminar
        ],
        "encoding":   "latin-1",
        "delimiter":  ";",
        "table":      ("fact", "ventas"),
        "pk_cols":    ["Num.Factura", "Cod_cliente", "Codigo_Mat", "Fecha.Doc", "OrgVtas"],
        "upsert_mode":"merge",
        # Estas columnas se eliminan porque son redundantes:
        # la info ya existe en las dimensiones y se obtiene por JOIN
        "drop_cols": {
            "Razón Social",          # → dim.cliente.nombre_cliente
            "Denominacion Material", # → dim.producto.denominacion_material
            "Jerarquía 1",           # → dim.producto.jerarquia_1
            "Jerarquía 2",           # → dim.producto.jerarquia_2
            "Jerarquía 3",           # → dim.producto.jerarquia_3
            "Ramo",                  # → dim.cliente → cat.ramo
            "Gr.Material",           # → dim.producto.gr_material
            "Gr.Articulo",           # → dim.producto.gr_articulo
            "Vendedor",              # → dim.vendedor.nombre_vendedor (texto libre)
            "Grp.Vend",              # → dim.vendedor via CodVend
            "Doc.Anulac",            # siempre vacío en datos reales
            "Peso.Total",            # siempre vacío en datos reales
            "",                      # columnas sin nombre (SAP bug)
        },
        # Columnas que van al raw.ventas con mapeo de nombre
        "raw_col_map": {
            "Razón Social":          "razon_social",
            "Gr Clientes":          "gpo_de_cliente",
            "Clase Doc.":           "clase_doc",
            "Num.Factura":          "num_factura",
            "Sector":               "sector",
            "Canal":                "canal",
            "Fecha.Doc":            "fecha_doc",
            "Zona Vtas.":           "zona_vtas",
            "Almacén":              "almacen",
            "Denominacion Material":"denominacion_material",
            "Cantidad UMV":         "cantidad_umv",
            "UM Vtas.":             "um_vtas",
            "Cantidad UMB":         "cantidad_umb",
            "UM Base":              "um_base",
            "Prec.Unitario":        "prec_unitario",
            "Mto.Neto":             "monto_neto",
            "IVA":                  "iva",
            "Importe Final":        "importe_final",
            "Doc.Comercial":        "doc_comercial",
            "Cond.Pago":            "cond_pago",
            "Fec.Venc.":            "fec_venc",
            "Moneda.Doc.":          "moneda_doc",
            "Status Anulación":     "status_anulacion",
            "Doc.Anulac.":          "doc_anulac",
            "Grp.Vend":             "grp_vend",
            "Vendedor":             "vendedor",
            "Referencia":           "referencia",
            "Pedido Vta.":          "pedido_vta",
            "Jerarquía 1":          "jerarquia_1",
            "Jerarquía 2":          "jerarquia_2",
            "Jerarquía 3":          "jerarquia_3",
            "UM Peso":              "um_peso",
            "Peso Fact.":           "peso_fact",
            "Peso.Total":           "peso_total",
            "UM Peso Gen.":         "um_peso_gen",
            "Ramo":                 "ramo",
            "Gr.Material":          "gr_material",
            "Gr.Articulo":          "gr_articulo",
            "Tipo Cambio":          "tipo_cambio",
            "Mes":                  "mes",
            "Ejercicio":            "ejercicio",
            "Prec.Unitario.2":      "prec_unitario_2",
            "Mto.Neto.2":           "monto_neto_2",
            "IVA.2":                "iva_2",
            "Importe Final.2":      "importe_final_2",
            "Conc.Búsq.":           "conc_busq",
            "Codigo_Mat":           "codigo_mat",
            "Listas.Precios":       "listas_precios",
            "Cod_cliente":          "cod_cliente",
            "Ind.RetCl":            "ind_retcl",
            "Ind.AutoRetCl":        "ind_auto_retcl",
            "FechaHora":            "fechahora",
            "Cod_Mot":              "cod_mot",
            "Tx_Motivo":            "tx_motivo",
            "CodVend":              "cod_vend",
            "Org.Vtas.":            "org_vtas",
        },
    },

    # ────────────────────────────────────────────────────────────
    # CxC — AVPH.CSV
    # PK: n_documento + cod_cliente + cod_clase_doc + asignacion + cod_moneda + valor
    # ────────────────────────────────────────────────────────────
    "AVPH": {
        "file":       "AVPH.CSV",
        "file_patterns": [
            r"AVPH\.CSV",
            r"AVPP\.CSV",
            r"AVAM\.CSV",
            r"AV(?:_| )EMPAQUE\.CSV", #eliminar
        ],
        "encoding":   "latin-1",
        "delimiter":  ";",
        "table":      ("fact", "cxc"),
        "pk_cols":    ["N°.Documento", "Cliente", "Cl.Doc.", "Asignación", "Mon.F.", "Valor monetario", "Sociedad"],
        "upsert_mode":"merge",
        "drop_cols": {
            "Nombre del Cliente",
            "Nombre del Vendedor",
            "Descripción Cl.Doc.",
            "Descripción Cond.Pago",
            "Descripción Ramo",
            "Descripción Gr Clien",
            "Descripción Zona",
            "Descripción Grupo Ve",
            "Nombre Gte. Regional",
        },
    },

    # ────────────────────────────────────────────────────────────
    # ENTREGAS — NEXFAC20.CSV
    # PK: Entrega + PosPed
    # ────────────────────────────────────────────────────────────
    "NEXFAC": {
        "file":       "NEXFAC20.CSV",
        "file_patterns": [r"NEXFAC\d+\.CSV"],
        "encoding":   "latin-1",
        "delimiter":  ";",
        "table":      ("fact", "entregas"),
        "pk_cols":    ["Entrega", "PosPed"],
        "upsert_mode":"merge",
        "drop_cols": {
            "Nombre del solicitante",
            "Denominación",
            "Marca",
            "Grupo",
            "Sector",
            "Categoría",
            "Grupo Vend",
            "Vendedor",
        },
    },

    # ────────────────────────────────────────────────────────────
    # PEDIDOS AÑO COMPLETO — PEDIDOSFULL20.CSV
    # Tabla destino: fact.pedidos con es_mes_actual=FALSE
    # ────────────────────────────────────────────────────────────
    "PEDIDOSFULL": {
        "file":          "PEDIDOSFULL20.CSV",
        "file_patterns": [r"PEDIDOSFULL\d+\.CSV"],
        "encoding":      "latin-1",
        "delimiter":     ";",
        "table":         ("fact", "pedidos"),
        "pk_cols":       ["  Doc.comer.", "Pedido", "Material"],
        "upsert_mode":   "merge",
        "es_mes_actual": False,
        "drop_cols": {
            "Denominación",
            "Nombre 1",
            "Tx Gr.Ventas",
        },
    },

    # ────────────────────────────────────────────────────────────
    # PEDIDOS MES ACTUAL — PEDIDOS20.CSV
    # Tabla destino: fact.pedidos con es_mes_actual=TRUE
    # ────────────────────────────────────────────────────────────
    "PEDIDOS": {
        "file":          "PEDIDOS20.CSV",
        "file_patterns": [r"PEDIDOS(?!FULL)\d+\.CSV"],
        "encoding":      "latin-1",
        "delimiter":     ";",
        "table":         ("fact", "pedidos"),
        "pk_cols":       ["  Doc.comer.", "Pedido", "Material"],
        "upsert_mode":   "merge",
        "es_mes_actual": True,
        "drop_cols": {
            "Denominación",
            "Nombre 1",
            "Tx Gr.Ventas",
        },
    },

    # ────────────────────────────────────────────────────────────
    # CLIENTES — CLIENTES.CSV
    # Las columnas Descripción* se usan para poblar catálogos
    # y luego se descartan del INSERT en dim.cliente
    # ────────────────────────────────────────────────────────────
    "CLIENTES": {
        "file":       "CLIENTES.CSV",
        "file_patterns": [
            r"CLIENTES\.CSV",
            r"CLIENTES(?:_| )PET\.CSV",
            r"CLIENTES(?:_| )AMP\.CSV",
        ],
        "encoding":   "latin-1",
        "delimiter":  ";",
        "table":      ("dim", "cliente"),
        "pk_cols":    ["Cod. Cliente"],
        "upsert_mode":"merge",
        "drop_cols": {
            "Descripción Cond Pag",
            "Descripción Ramo",
            "Descripción Gr Clien",
            "Descripción Zona",
            "Descripción Grupo Ve",
            "Nombre_vendedor",
            "Nombre Gte. Regional",
            "Denominacion",
        },
    },

    # ────────────────────────────────────────────────────────────
    # INVENTARIO PT — INVPT_XX.CSV
    # tipo_inv = 'PT' | SNAPSHOT (truncate + reload)
    # ────────────────────────────────────────────────────────────
    "INVPT": {
        "file":       "INVPT_XX.CSV",
        "file_patterns": [
            r"INVPT(?:_| )XX\.CSV",
            r"INVPT(?:_| )1200\.CSV",
            r"INVPT(?:_| )1300\.CSV",
        ],
        "encoding":   "latin-1",
        "delimiter":  ";",
        "table":      ("fact", "inventario"),
        "pk_cols":    ["Codigo_Mat", "Centro", "Almacen"],
        "upsert_mode":"snapshot",
        "tipo_inv":   "PT",
        "drop_cols": {
            "Denominacion Material",
        },
    },

    # ────────────────────────────────────────────────────────────
    # INVENTARIO PT GENERAL — INVPT_XXGENERAL.CSV
    # tipo_inv = 'PT_GENERAL'
    # ────────────────────────────────────────────────────────────
    "INVPT_GENERAL": {
        "file":       "INVPT_XXGENERAL.CSV",
        "file_patterns": [r"INVPT(?:_| )XXGENERAL\.CSV"],
        "encoding":   "latin-1",
        "delimiter":  ";",
        "table":      ("fact", "inventario"),
        "pk_cols":    ["Codigo_Mat", "Centro", "Almacen"],
        "upsert_mode":"snapshot",
        "tipo_inv":   "PT_GENERAL",
        "drop_cols": {
            "Denominacion Material",
        },
    },

    # ────────────────────────────────────────────────────────────
    # INVENTARIO MP — INVMP_XX.CSV
    # tipo_inv = 'MP'
    # ────────────────────────────────────────────────────────────
    "INVMP": {
        "file":       "INVMP_XX.CSV",
        "file_patterns": [
            r"INVMP(?:_| )XX\.CSV",
            r"INVMP(?:_| )1200\.CSV",
            r"INVMP(?:_| )1300\.CSV",
        ],
        "encoding":   "latin-1",
        "delimiter":  ";",
        "table":      ("fact", "inventario"),
        "pk_cols":    ["Codigo_Mat", "Centro", "Almacen"],
        "upsert_mode":"snapshot",
        "tipo_inv":   "MP",
        "drop_cols": {
            "Denominacion Material",
        },
    },

    # ────────────────────────────────────────────────────────────
    # INVENTARIO PT VALORIZADO — INVENTARIOS.CSV
    # tipo_inv = 'PT_VALORIZADO' | SNAPSHOT
    # Mismo scope que INVPT pero CON valores monetarios
    # (Valor_Lut, Valor_Cal, Valor_Blo) + Categoria, Marca, Grupo, Sector
    # ────────────────────────────────────────────────────────────
    "INVENTARIOS": {
        "file":       "INVENTARIOS.CSV",
        "encoding":   "latin-1",
        "delimiter":  ";",
        "table":      ("fact", "inventario"),
        "pk_cols":    ["Codigo_Mat", "Centro", "Almacen"],
        "upsert_mode":"snapshot",
        "tipo_inv":   "PT_VALORIZADO",
        "drop_cols": {
            "Denominacion Material",
        },
    },

    # ────────────────────────────────────────────────────────────
    # ÓRDENES PHARSANA — O_PHXX.CSV → fact.ordenes planta='PH'
    # ────────────────────────────────────────────────────────────
    "O_PH": {
        "file":       "O_PHXX.CSV",
        "file_patterns": [r"O_PHXX\.CSV"],
        "encoding":   "latin-1",
        "delimiter":  ";",
        "table":      ("fact", "ordenes"),
        "pk_cols":    ["Orden", "Codigo_Mat", "Centro"],
        "upsert_mode":"merge",
        "planta":     "PH",
        "drop_cols": {
            "Denominacion Material",
            "Texto ClOrden",
        },
    },

    # ────────────────────────────────────────────────────────────
    # ÓRDENES HIGIÉNICOS — O_HGXX.CSV → fact.ordenes planta='HG'
    # ────────────────────────────────────────────────────────────
    "O_HG": {
        "file":       "O_HGXX.CSV",
        "file_patterns": [r"O_HGXX\.CSV"],
        "encoding":   "latin-1",
        "delimiter":  ";",
        "table":      ("fact", "ordenes"),
        "pk_cols":    ["Orden", "Codigo_Mat", "Centro"],
        "upsert_mode":"merge",
        "planta":     "HG",
        "drop_cols": {
            "Denominacion Material",
            "Texto ClOrden",
        },
    },

    # ────────────────────────────────────────────────────────────
    # ÓRDENES PM — O_PMXX.CSV → fact.ordenes planta='PM'
    # ────────────────────────────────────────────────────────────
    "O_PM": {
        "file":       "O_PMXX.CSV",
        "file_patterns": [r"O_PMXX\.CSV"],
        "encoding":   "latin-1",
        "delimiter":  ";",
        "table":      ("fact", "ordenes"),
        "pk_cols":    ["Orden", "Codigo_Mat", "Centro"],
        "upsert_mode":"merge",
        "planta":     "PM",
        "drop_cols": {
            "Denominacion Material",
            "Texto ClOrden",
        },
    },

    # ────────────────────────────────────────────────────────────
    # ÓRDENES PROYECTOS PET — O_PPXX.CSV → fact.ordenes planta='PP'
    # ────────────────────────────────────────────────────────────
    "O_PP": {
        "file":       "O_PPXX.CSV",
        "file_patterns": [r"O_PPXX\.CSV"],
        "encoding":   "latin-1",
        "delimiter":  ";",
        "table":      ("fact", "ordenes"),
        "pk_cols":    ["Orden", "Codigo_Mat", "Centro"],
        "upsert_mode":"merge",
        "planta":     "PP",
        "drop_cols": {
            "Denominacion Material",
            "Texto ClOrden",
        },
    },

    # ────────────────────────────────────────────────────────────
    # ÓRDENES AMPOFRASCA — O_AMXX.CSV → fact.ordenes planta='AM'
    # ────────────────────────────────────────────────────────────
    "O_AM": {
        "file":       "O_AMXX.CSV",
        "file_patterns": [r"O_AMXX\.CSV"],
        "encoding":   "latin-1",
        "delimiter":  ";",
        "table":      ("fact", "ordenes"),
        "pk_cols":    ["Orden", "Codigo_Mat", "Centro"],
        "upsert_mode":"merge",
        "planta":     "AM",
        "drop_cols": {
            "Denominacion Material",
            "Texto ClOrden",
        },
    },

    # ────────────────────────────────────────────────────────────
    # CONSUMOS PHARSANA — C_PHXX.CSV → fact.consumos planta='PH'
    # ────────────────────────────────────────────────────────────
    "C_PH": {
        "file":       "C_PHXX.CSV",
        "file_patterns": [r"C_PHXX\.CSV"],
        "encoding":   "latin-1",
        "delimiter":  ";",
        "table":      ("fact", "consumos"),
        "pk_cols":    ["Codigo_Mat", "Orden", "Origen"],
        "upsert_mode":"merge",
        "planta":     "PH",
        "drop_cols": {
            "Denominacion Material",
        },
    },

    # ────────────────────────────────────────────────────────────
    # CONSUMOS HIGIÉNICOS — C_HGXX.CSV → fact.consumos planta='HG'
    # ────────────────────────────────────────────────────────────
    "C_HG": {
        "file":       "C_HGXX.CSV",
        "file_patterns": [r"C_HGXX\.CSV"],
        "encoding":   "latin-1",
        "delimiter":  ";",
        "table":      ("fact", "consumos"),
        "pk_cols":    ["Codigo_Mat", "Orden", "Origen"],
        "upsert_mode":"merge",
        "planta":     "HG",
        "drop_cols": {
            "Denominacion Material",
        },
    },

    # ────────────────────────────────────────────────────────────
    # CONSUMOS PROYECTOS PET — C_PPXX.CSV → fact.consumos planta='PP'
    # ────────────────────────────────────────────────────────────
    "C_PP": {
        "file":       "C_PPXX.CSV",
        "file_patterns": [r"C_PPXX\.CSV"],
        "encoding":   "latin-1",
        "delimiter":  ";",
        "table":      ("fact", "consumos"),
        "pk_cols":    ["Codigo_Mat", "Orden", "Origen"],
        "upsert_mode":"merge",
        "planta":     "PP",
        "drop_cols": {
            "Denominacion Material",
        },
    },

    # ────────────────────────────────────────────────────────────
    # CONSUMOS AMPOFRASCA — C_AMXX.CSV → fact.consumos planta='AM'
    # ────────────────────────────────────────────────────────────
    "C_AM": {
        "file":       "C_AMXX.CSV",
        "file_patterns": [r"C_AMXX\.CSV"],
        "encoding":   "latin-1",
        "delimiter":  ";",
        "table":      ("fact", "consumos"),
        "pk_cols":    ["Codigo_Mat", "Orden", "Origen"],
        "upsert_mode":"merge",
        "planta":     "AM",
        "drop_cols": {
            "Denominacion Material",
        },
    },

    # ────────────────────────────────────────────────────────────
    # NOTIFICACIONES — N_PHXX.CSV
    # ────────────────────────────────────────────────────────────
    "N_PH": {
        "file":       "N_PHXX.CSV",
        "file_patterns": [r"N_PHXX\.CSV"],
        "encoding":   "latin-1",
        "delimiter":  ";",
        "table":      ("fact", "notificaciones"),
        "pk_cols":    ["Codigo_Mat", "Fecha", "UM"],
        "upsert_mode":"merge",
        "drop_cols": {
            "Denominacion Material",
            "Categoría",
            "Marca",
            "Grupo",
        },
    },

    # ────────────────────────────────────────────────────────────
    # NOTIFICACIONES PROYECTOS PET — N_PPXX.CSV
    # ────────────────────────────────────────────────────────────
    "N_PP": {
        "file":       "N_PPXX.CSV",
        "file_patterns": [r"N_PPXX\.CSV"],
        "encoding":   "latin-1",
        "delimiter":  ";",
        "table":      ("fact", "notificaciones"),
        "pk_cols":    ["Codigo_Mat", "Fecha", "UM"],
        "upsert_mode":"merge",
        "drop_cols": {
            "Denominacion Material",
        },
    },

    # ────────────────────────────────────────────────────────────
    # NOTIFICACIONES AMPOFRASCA — N_AMXX.CSV
    # ────────────────────────────────────────────────────────────
    "N_AM": {
        "file":       "N_AMXX.CSV",
        "file_patterns": [r"N_AMXX\.CSV"],
        "encoding":   "latin-1",
        "delimiter":  ";",
        "table":      ("fact", "notificaciones"),
        "pk_cols":    ["Codigo_Mat", "Fecha", "UM"],
        "upsert_mode":"merge",
        "drop_cols": {
            "Denominacion Material",
        },
    },

    # ────────────────────────────────────────────────────────────
    # PRECIOS — PRECIOS.CSV
    # ────────────────────────────────────────────────────────────
    "PRECIOS": {
        "file":       "PRECIOS.CSV",
        "encoding":   "latin-1",
        "delimiter":  ";",
        "table":      ("fact", "precios"),
        "pk_cols":    ["ClCd", "OrgVt", "LP", "Material"],
        "upsert_mode":"snapshot",
        "drop_cols": {
            "Texto breve de material",
            "Texto",
        },
    },

    # ────────────────────────────────────────────────────────────
    # CxP — AVAC_PH.CSV (Cuentas por Pagar)
    # PK: Nº doc. + Proveedor + Clase Doc + Asignacion + Mon.
    # ────────────────────────────────────────────────────────────
    "AVAC": {
        "file":       "AVAC_PH.CSV",
        "file_patterns": [
            r"AVAC_PH\.CSV",
            r"AVAC_PP\.CSV",
            r"AVAC_AM\.CSV",
        ],
        "encoding":   "latin-1",
        "delimiter":  ";",
        "table":      ("fact", "cxp"),
        "pk_cols":    ["Nº doc.", "Proveedor", "Clase Doc", "Asignacion", "Mon.", "Soc."],
        "upsert_mode":"merge",
        "drop_cols": {
            "Denominación",
            "Descr.Ramo",
            "Txt.cabec.",
            "Gr.tes.",
        },
    },
}

# ────────────────────────────────────────────────────────────────
# Catálogos: pares cod+descripcion que se extraen de los archivos
# y se insertan en cat.* ANTES de cargar las dimensiones
# ────────────────────────────────────────────────────────────────
CATALOGS = [
    # (tabla_destino, archivo_fuente, col_codigo, col_descripcion, es_mock)
    ("cat.condicion_pago", "CLIENTES", "Cond. Pago",   "Descripción Cond Pag",  False),
    ("cat.ramo",           "CLIENTES", "Ramo",          "Descripción Ramo",       False),
    ("cat.gpo_cliente",    "CLIENTES", "Gr Clientes",   "Descripción Gr Clien",   False),
    ("cat.zona_ventas",    "CLIENTES", "Zona Ventas",   "Descripción Zona",        False),
    ("cat.grp_vendedor",   "CLIENTES", "Grupo Vend.",   "Descripción Grupo Ve",    False),
    ("cat.lista_precio",   "CLIENTES", "Lista",         "Denominacion",            False),
    ("cat.canal",          "CLIENTES", "Canal",         "Canal",                   False),
    ("cat.clase_doc",      "AVPH",     "Cl.Doc.",       "Descripción Cl.Doc.",     False),
    ("cat.clase_orden",    "O_PH",     "Clase Orden",   "Texto ClOrden",           False),
    # sector: texto libre → es_mock=True, col_desc = col_cod (son lo mismo)
    ("cat.sector",         "PHXX",     "Sector",        "Sector",                  True),
]

# ────────────────────────────────────────────────────────────────
# Fuentes para construir dim.producto (en orden de prioridad)
# Si dos fuentes tienen datos para el mismo campo, gana la de mayor prioridad
# ────────────────────────────────────────────────────────────────
PRODUCTO_SOURCES = [
    # (source_key, {col_csv: col_dim})
    ("INVPT", {
        "Codigo_Mat":           "codigo_mat",
        "Denominacion Material":"denominacion_material",
        "Categoría":            "categoria",
        "Marca":                "marca",
        "Grupo":                "gr_material",
        "Sector":               "sector_texto",   # se resuelve a cod luego
    }),
    ("INVENTARIOS", {
        "Codigo_Mat":           "codigo_mat",
        "Denominacion Material":"denominacion_material",
        "Categoría":            "categoria",
        "Marca":                "marca",
        "Grupo":                "gr_material",
        "Sector":               "sector_texto",
    }),
    ("INVPT_GENERAL", {
        "Codigo_Mat":           "codigo_mat",
        "Denominacion Material":"denominacion_material",
    }),
    ("NEXFAC", {
        "Codigo_Mat":           "codigo_mat",
        "Denominación":         "denominacion_material",
        "Categoría":            "categoria",
        "Marca":                "marca",
        "Grupo":                "gr_material",
        "Sector":               "sector_texto",
    }),
    ("PHXX", {
        "Codigo_Mat":           "codigo_mat",
        "Denominacion Material":"denominacion_material",
        "Jerarquía 1":          "jerarquia_1",
        "Jerarquía 2":          "jerarquia_2",
        "Jerarquía 3":          "jerarquia_3",
        "Gr.Material":          "gr_material",
        "Gr.Articulo":          "gr_articulo",
    }),
    ("INVMP", {
        "Codigo_Mat":           "codigo_mat",
        "Denominacion Material":"denominacion_material",
    }),
]

# Orden en que se procesan las fuentes de hechos
# (catálogos y dims siempre van antes, hardcoded en el pipeline)
FACT_LOAD_ORDER = [
    "PHXX",
    "AVPH",
    "AVAC",
    "NEXFAC",
    "PEDIDOSFULL",
    "PEDIDOS",
    "INVPT",
    "INVPT_GENERAL",
    "INVMP",
    "INVENTARIOS",
    "O_PH",
    "O_HG",
    "O_PM",
    "O_PP",
    "O_AM",
    "C_PH",
    "C_HG",
    "C_PP",
    "C_AM",
    "N_PH",
    "N_PP",
    "N_AM",
    "PRECIOS",
]

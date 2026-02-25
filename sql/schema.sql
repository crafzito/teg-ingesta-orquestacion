-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  PHARSANA SAP ETL — Schema completo v2                          ║
-- ║  Ejecutar: psql $PG_DSN -f schema.sql                           ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ─── SCHEMAS ──────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS cat;   -- catálogos SAP (cod + descripcion)
CREATE SCHEMA IF NOT EXISTS dim;   -- dimensiones maestro
CREATE SCHEMA IF NOT EXISTS fact;  -- tablas de hechos
CREATE SCHEMA IF NOT EXISTS raw;   -- CSV sin transformar (auditoría)
CREATE SCHEMA IF NOT EXISTS etl;   -- control del pipeline

-- ══════════════════════════════════════════════════════════════════
-- CATÁLOGOS
-- Todos tienen: cod (PK) + descripcion + es_mock + updated_at
-- es_mock=FALSE → código oficial SAP
-- es_mock=TRUE  → código generado por el ETL (SAP exporta solo texto)
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cat.condicion_pago (
    cod         VARCHAR(20)  PRIMARY KEY,
    descripcion VARCHAR(150) NOT NULL,
    es_mock     BOOLEAN      NOT NULL DEFAULT FALSE,
    updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cat.ramo (
    cod         VARCHAR(20)  PRIMARY KEY,
    descripcion VARCHAR(150) NOT NULL,
    es_mock     BOOLEAN      NOT NULL DEFAULT FALSE,
    updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cat.gpo_cliente (
    cod         VARCHAR(20)  PRIMARY KEY,
    descripcion VARCHAR(150) NOT NULL,
    es_mock     BOOLEAN      NOT NULL DEFAULT FALSE,
    updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cat.zona_ventas (
    cod         VARCHAR(20)  PRIMARY KEY,
    descripcion VARCHAR(150) NOT NULL,
    es_mock     BOOLEAN      NOT NULL DEFAULT FALSE,
    updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cat.grp_vendedor (
    cod         VARCHAR(20)  PRIMARY KEY,
    descripcion VARCHAR(150) NOT NULL,
    es_mock     BOOLEAN      NOT NULL DEFAULT FALSE,
    updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cat.lista_precio (
    cod         VARCHAR(20)  PRIMARY KEY,
    descripcion VARCHAR(200) NOT NULL,
    es_mock     BOOLEAN      NOT NULL DEFAULT FALSE,
    updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cat.canal (
    cod         VARCHAR(20)  PRIMARY KEY,
    descripcion VARCHAR(150) NOT NULL,
    es_mock     BOOLEAN      NOT NULL DEFAULT FALSE,
    updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cat.clase_doc (
    cod         VARCHAR(20)  PRIMARY KEY,
    descripcion VARCHAR(150) NOT NULL,
    es_mock     BOOLEAN      NOT NULL DEFAULT FALSE,
    updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cat.clase_orden (
    cod         VARCHAR(20)  PRIMARY KEY,
    descripcion VARCHAR(200) NOT NULL,
    es_mock     BOOLEAN      NOT NULL DEFAULT FALSE,
    updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- Sector: SAP exporta solo texto libre, sin código oficial
CREATE TABLE IF NOT EXISTS cat.sector (
    cod         VARCHAR(20)  PRIMARY KEY,   -- MD5 generado por ETL
    descripcion VARCHAR(150) NOT NULL,
    es_mock     BOOLEAN      NOT NULL DEFAULT TRUE,  -- siempre TRUE
    updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════
-- DIMENSIONES
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dim.vendedor (
    cod_vendedor    VARCHAR(20)  PRIMARY KEY,
    nombre_vendedor TEXT,
    tipo            VARCHAR(10)  NOT NULL DEFAULT 'VENDEDOR',
    batch_id        VARCHAR(64),
    _created_at     TIMESTAMPTZ  DEFAULT NOW(),
    _updated_at     TIMESTAMPTZ  DEFAULT NOW()
);
COMMENT ON COLUMN dim.vendedor.tipo IS 'VENDEDOR o GERENTE';

CREATE TABLE IF NOT EXISTS dim.producto (
    codigo_mat            VARCHAR(30)  PRIMARY KEY,
    denominacion_material TEXT         NOT NULL,
    categoria             VARCHAR(100),
    marca                 VARCHAR(100),
    sector_cod            VARCHAR(20)  /* REFERENCES cat.sector(cod) */,
    gr_material           TEXT,
    gr_articulo           TEXT,
    jerarquia_1           TEXT,
    jerarquia_2           TEXT,
    jerarquia_3           TEXT,
    batch_id              VARCHAR(64),
    _created_at           TIMESTAMPTZ  DEFAULT NOW(),
    _updated_at           TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prod_cat  ON dim.producto(categoria);
CREATE INDEX IF NOT EXISTS idx_prod_marc ON dim.producto(marca);

CREATE TABLE IF NOT EXISTS dim.cliente (
    cod_cliente             VARCHAR(20)  PRIMARY KEY,
    nombre_cliente          TEXT,
    rif                     VARCHAR(30),
    direccion               TEXT,
    telefono_fijo           VARCHAR(50),
    telefono_movil          VARCHAR(50),
    nombre_contacto         TEXT,
    poblacion               TEXT,
    estado                  TEXT,
    moneda                  VARCHAR(10),
    cod_ruta_transporte     VARCHAR(30),
    fecha_creacion_cliente  DATE,
    agente_retencion_flag   BOOLEAN,
    num_ultima_factura      VARCHAR(30),
    fecha_ultima_factura    DATE,
    num_ultimo_pago         VARCHAR(30),
    fecha_ultimo_pago       DATE,
    -- FKs a catálogos
    cod_condicion_pago  VARCHAR(20) /* REFERENCES cat.condicion_pago(cod) */,
    cod_ramo            VARCHAR(20) /* REFERENCES cat.ramo(cod) */,
    cod_gpo_cliente     VARCHAR(20) /* REFERENCES cat.gpo_cliente(cod) */,
    cod_zona_ventas     VARCHAR(20) /* REFERENCES cat.zona_ventas(cod) */,
    cod_grp_vendedor    VARCHAR(20) /* REFERENCES cat.grp_vendedor(cod) */,
    cod_lista_precio    VARCHAR(20) /* REFERENCES cat.lista_precio(cod) */,
    cod_canal           VARCHAR(20) /* REFERENCES cat.canal(cod) */,
    -- FKs a vendedor (dos apuntando a la misma tabla)
    cod_vendedor        VARCHAR(20) /* REFERENCES dim.vendedor(cod_vendedor) */,
    cod_gerente         VARCHAR(20) /* REFERENCES dim.vendedor(cod_vendedor) */,
    -- Flags
    is_placeholder      BOOLEAN      NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    batch_id            VARCHAR(64),
    _created_at         TIMESTAMPTZ  DEFAULT NOW(),
    _updated_at         TIMESTAMPTZ  DEFAULT NOW()
);
COMMENT ON COLUMN dim.cliente.is_placeholder IS
    'TRUE = cliente que aparece en ventas/pedidos pero no está en CLIENTES.CSV';

-- Índices para filtros comunes en dim.cliente
CREATE INDEX IF NOT EXISTS idx_cli_zona   ON dim.cliente(cod_zona_ventas);
CREATE INDEX IF NOT EXISTS idx_cli_ramo   ON dim.cliente(cod_ramo);
CREATE INDEX IF NOT EXISTS idx_cli_vend   ON dim.cliente(cod_vendedor);
CREATE INDEX IF NOT EXISTS idx_cli_estado ON dim.cliente(estado);
CREATE INDEX IF NOT EXISTS idx_cli_active ON dim.cliente(is_active) WHERE is_active = TRUE;

-- ══════════════════════════════════════════════════════════════════
-- HECHOS
-- Estructura estándar: id + line_hash + batch_id + FKs + métricas
-- FKs usan VARCHAR (código SAP) → legible sin JOINs
-- ══════════════════════════════════════════════════════════════════

-- ── VENTAS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fact.ventas (
    ventas_id          BIGSERIAL    PRIMARY KEY,
    line_hash          VARCHAR(32)  NOT NULL UNIQUE,
    batch_id           VARCHAR(64)  NOT NULL,
    -- Quién, qué, quién vendió
    cod_cliente        VARCHAR(20)  /* REFERENCES dim.cliente(cod_cliente) */,
    codigo_mat         VARCHAR(30)  /* REFERENCES dim.producto(codigo_mat) */,
    cod_vendedor       VARCHAR(20)  /* REFERENCES dim.vendedor(cod_vendedor) */,
    -- Catálogos
    cod_condicion_pago VARCHAR(20),
    cod_sector         VARCHAR(20),
    canal_texto        VARCHAR(50),   -- texto libre SAP (Venta Directa / Autoconsumo)
    -- Documento
    num_factura        VARCHAR(30),
    clase_doc          VARCHAR(30),
    referencia         VARCHAR(30),
    pedido_vta         VARCHAR(30),
    almacen            VARCHAR(10),
    org_vtas           VARCHAR(10),
    cod_moneda         VARCHAR(10),
    status_anulacion   VARCHAR(10),
    ind_retcl          VARCHAR(10),
    ind_auto_retcl     VARCHAR(10),
    cod_mot            VARCHAR(10),
    -- Fechas
    fecha_doc          DATE         NOT NULL,
    fec_venc           DATE,
    fechahora          TIMESTAMPTZ,
    mes                SMALLINT,
    ejercicio          SMALLINT,
    -- Cantidades
    cantidad_umv       NUMERIC(18,4),
    um_vtas            VARCHAR(10),
    cantidad_umb       NUMERIC(18,4),
    um_base            VARCHAR(10),
    -- Montos VED
    prec_unitario      NUMERIC(18,4),
    monto_neto         NUMERIC(18,4),
    iva                NUMERIC(18,4),
    importe_final      NUMERIC(18,4),
    -- Conversión USD
    tipo_cambio        NUMERIC(18,6),
    prec_unitario_usd  NUMERIC(18,4),
    monto_neto_usd     NUMERIC(18,4),
    iva_usd            NUMERIC(18,4),
    importe_final_usd  NUMERIC(18,4),
    -- Peso
    peso_fact          NUMERIC(18,4),
    um_peso            VARCHAR(10),
    _loaded_at         TIMESTAMPTZ  DEFAULT NOW()
);

-- Índices para queries de ventas (dashboard, filtros frecuentes)
CREATE INDEX IF NOT EXISTS idx_v_cliente    ON fact.ventas(cod_cliente);
CREATE INDEX IF NOT EXISTS idx_v_producto   ON fact.ventas(codigo_mat);
CREATE INDEX IF NOT EXISTS idx_v_vendedor   ON fact.ventas(cod_vendedor);
CREATE INDEX IF NOT EXISTS idx_v_fecha      ON fact.ventas(fecha_doc);
CREATE INDEX IF NOT EXISTS idx_v_mes_ej     ON fact.ventas(ejercicio, mes);
CREATE INDEX IF NOT EXISTS idx_v_factura    ON fact.ventas(num_factura);
CREATE INDEX IF NOT EXISTS idx_v_sector     ON fact.ventas(cod_sector);
-- Índice compuesto para el query más frecuente: ventas por cliente+período
CREATE INDEX IF NOT EXISTS idx_v_cli_fecha  ON fact.ventas(cod_cliente, fecha_doc);
-- Índice para totales USD (query de dashboard principal)
CREATE INDEX IF NOT EXISTS idx_v_ej_usd     ON fact.ventas(ejercicio, mes, importe_final_usd);

-- ── CXC ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fact.cxc (
    cxc_id             BIGSERIAL    PRIMARY KEY,
    line_hash          VARCHAR(32)  NOT NULL UNIQUE,
    batch_id           VARCHAR(64)  NOT NULL,
    cod_cliente        VARCHAR(20)  /* REFERENCES dim.cliente(cod_cliente) */,
    cod_vendedor       VARCHAR(20)  /* REFERENCES dim.vendedor(cod_vendedor) */,
    cod_clase_doc      VARCHAR(20),
    cod_condicion_pago VARCHAR(20),
    cod_moneda         VARCHAR(10),
    n_documento        VARCHAR(30),
    asignacion         VARCHAR(30),
    sociedad           VARCHAR(10),
    texto              TEXT,
    fecha_doc          DATE,
    fecha_base         DATE,
    d_venc             SMALLINT,
    fecha_venc         DATE,
    -- Aging (cuánto debe y en qué tramo de vencimiento)
    valor_monetario    NUMERIC(18,2),
    no_vencido         NUMERIC(18,2),
    venc_1_15          NUMERIC(18,2),
    venc_16_30         NUMERIC(18,2),
    venc_31_60         NUMERIC(18,2),
    venc_61_90         NUMERIC(18,2),
    venc_91_mas        NUMERIC(18,2),
    tc_conversion      NUMERIC(18,6),
    importe_ml         NUMERIC(18,2),
    importe_md         NUMERIC(18,2),
    _loaded_at         TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cxc_cliente ON fact.cxc(cod_cliente);
CREATE INDEX IF NOT EXISTS idx_cxc_venc    ON fact.cxc(fecha_venc);
-- Query frecuente: deuda vencida total por cliente
CREATE INDEX IF NOT EXISTS idx_cxc_cli_venc ON fact.cxc(cod_cliente, fecha_venc);

-- ── ENTREGAS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fact.entregas (
    entrega_id         BIGSERIAL    PRIMARY KEY,
    line_hash          VARCHAR(32)  NOT NULL UNIQUE,
    batch_id           VARCHAR(64)  NOT NULL,
    cod_cliente        VARCHAR(20)  /* REFERENCES dim.cliente(cod_cliente) */,
    codigo_mat         VARCHAR(30)  /* REFERENCES dim.producto(codigo_mat) */,
    cod_vendedor       VARCHAR(20)  /* REFERENCES dim.vendedor(cod_vendedor) */,
    cod_moneda         VARCHAR(10),
    num_entrega        VARCHAR(20)  NOT NULL,
    pos_ped            VARCHAR(10)  NOT NULL,
    num_pedido         VARCHAR(30),
    destinatario       VARCHAR(20),
    clase_entrega      VARCHAR(50),
    zona_texto         VARCHAR(100),
    mes_entrega        VARCHAR(10),
    fecha_entrega      DATE,
    fecha_real         TIMESTAMPTZ,
    cantidad           NUMERIC(18,3),
    um                 VARCHAR(10),
    monto              NUMERIC(18,2),
    _loaded_at         TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_e_cliente  ON fact.entregas(cod_cliente);
CREATE INDEX IF NOT EXISTS idx_e_producto ON fact.entregas(codigo_mat);
CREATE INDEX IF NOT EXISTS idx_e_fecha    ON fact.entregas(fecha_entrega);

-- ── PEDIDOS ─────────────────────────────────────────────────────
-- Una sola tabla para PEDIDOSFULL + PEDIDOS20
-- es_mes_actual=TRUE → viene de PEDIDOS20
CREATE TABLE IF NOT EXISTS fact.pedidos (
    pedido_id          BIGSERIAL    PRIMARY KEY,
    line_hash          VARCHAR(32)  NOT NULL UNIQUE,
    batch_id           VARCHAR(64)  NOT NULL,
    cod_cliente        VARCHAR(20)  /* REFERENCES dim.cliente(cod_cliente) */,
    codigo_mat         VARCHAR(30)  /* REFERENCES dim.producto(codigo_mat) */,
    cod_moneda         VARCHAR(10),
    es_mes_actual      BOOLEAN      NOT NULL DEFAULT FALSE,
    doc_comer          VARCHAR(30),
    num_pedido         VARCHAR(30),
    status             VARCHAR(30),
    clase_vt           VARCHAR(10),
    almacen            VARCHAR(10),
    fecha_doc          DATE,
    fe_entrega         DATE,
    fe_precio          DATE,
    creado_el          DATE,
    fe_ped_app         DATE,
    ctd_conf           NUMERIC(18,3),
    ctd_ped            NUMERIC(18,3),
    tp_cambio          NUMERIC(18,6),
    prc_neto           NUMERIC(18,4),
    valor_neto         NUMERIC(18,2),
    neto               NUMERIC(18,2),
    _loaded_at         TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_p_cliente  ON fact.pedidos(cod_cliente);
CREATE INDEX IF NOT EXISTS idx_p_producto ON fact.pedidos(codigo_mat);
CREATE INDEX IF NOT EXISTS idx_p_fecha    ON fact.pedidos(fecha_doc);
CREATE INDEX IF NOT EXISTS idx_p_mes      ON fact.pedidos(es_mes_actual);
CREATE INDEX IF NOT EXISTS idx_p_status   ON fact.pedidos(status);

-- ── INVENTARIO ──────────────────────────────────────────────────
-- Una sola tabla para PT + PT_GENERAL + MP
-- tipo_inv distingue la fuente
-- SNAPSHOT: se trunca y recarga completo en cada ejecución
CREATE TABLE IF NOT EXISTS fact.inventario (
    inventario_id      BIGSERIAL    PRIMARY KEY,
    line_hash          VARCHAR(32)  NOT NULL UNIQUE,
    batch_id           VARCHAR(64)  NOT NULL,
    codigo_mat         VARCHAR(30)  /* REFERENCES dim.producto(codigo_mat) */,
    tipo_inv           VARCHAR(15)  NOT NULL,  -- PT | PT_GENERAL | MP
    centro             VARCHAR(20),
    almacen            VARCHAR(20),
    desc_almacen       VARCHAR(100),
    desc_centro        VARCHAR(100),
    cb                 VARCHAR(10),
    tp_mt              VARCHAR(10),   -- solo MP
    libre_ut           NUMERIC(18,3),
    calidad            NUMERIC(18,3),
    bloqueado          NUMERIC(18,3),
    valor_libre        NUMERIC(18,2), -- solo MP
    valor_calidad      NUMERIC(18,2), -- solo MP
    valor_bloqueado    NUMERIC(18,2), -- solo MP
    hora_snapshot      TIMESTAMPTZ,
    _loaded_at         TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_mat   ON fact.inventario(codigo_mat);
CREATE INDEX IF NOT EXISTS idx_inv_tipo  ON fact.inventario(tipo_inv);
CREATE INDEX IF NOT EXISTS idx_inv_cent  ON fact.inventario(centro, almacen);

-- ── ÓRDENES DE PRODUCCIÓN ───────────────────────────────────────
-- Una sola tabla para PH + HG + PM
CREATE TABLE IF NOT EXISTS fact.ordenes (
    orden_id           BIGSERIAL    PRIMARY KEY,
    line_hash          VARCHAR(32)  NOT NULL UNIQUE,
    batch_id           VARCHAR(64)  NOT NULL,
    codigo_mat         VARCHAR(30)  /* REFERENCES dim.producto(codigo_mat) */,
    cod_clase_orden    VARCHAR(20)  /* REFERENCES cat.clase_orden(cod) */,
    planta             VARCHAR(5)   NOT NULL,  -- PH | HG | PM
    num_orden          VARCHAR(30)  NOT NULL,
    centro             VARCHAR(20),
    reproceso          VARCHAR(10),
    estatus            VARCHAR(50),
    maquina            VARCHAR(200),
    fecha_ini_extrema  DATE,
    fecha_fin_extrema  DATE,
    fecha_ini_real     DATE,
    fecha_fin_real     DATE,
    fecha_liberacion   DATE,
    fecha_hora         TIMESTAMPTZ,
    cantidad_orden     NUMERIC(18,3),
    cantidad_recibida  NUMERIC(18,3),
    um_orden           VARCHAR(10),
    _loaded_at         TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ord_mat    ON fact.ordenes(codigo_mat);
CREATE INDEX IF NOT EXISTS idx_ord_planta ON fact.ordenes(planta);
CREATE INDEX IF NOT EXISTS idx_ord_fecha  ON fact.ordenes(fecha_ini_real);
CREATE INDEX IF NOT EXISTS idx_ord_status ON fact.ordenes(estatus);

-- ── CONSUMOS ────────────────────────────────────────────────────
-- Una sola tabla para PH + HG
CREATE TABLE IF NOT EXISTS fact.consumos (
    consumo_id         BIGSERIAL    PRIMARY KEY,
    line_hash          VARCHAR(32)  NOT NULL UNIQUE,
    batch_id           VARCHAR(64)  NOT NULL,
    codigo_mat         VARCHAR(30)  /* REFERENCES dim.producto(codigo_mat) */,
    planta             VARCHAR(5)   NOT NULL,  -- PH | HG
    num_orden          VARCHAR(30)  NOT NULL,
    umb                VARCHAR(10),
    cant_plan          NUMERIC(18,3),
    cant_real          NUMERIC(18,3),
    var_consumo        NUMERIC(18,3),
    pct_var_consumo    NUMERIC(10,2),
    tot_cos_plan       NUMERIC(18,2),
    tot_cos_real       NUMERIC(18,2),
    precio_std         NUMERIC(18,6),
    precio_var         NUMERIC(18,6),
    var_precio         NUMERIC(18,6),
    val_var_prec       NUMERIC(18,2),
    val_var_con        NUMERIC(18,2),
    tot_variacion      NUMERIC(18,2),
    c_planificada      NUMERIC(18,3),
    c_entregada        NUMERIC(18,3),
    _loaded_at         TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_con_mat    ON fact.consumos(codigo_mat);
CREATE INDEX IF NOT EXISTS idx_con_orden  ON fact.consumos(num_orden);
CREATE INDEX IF NOT EXISTS idx_con_planta ON fact.consumos(planta);

-- ── NOTIFICACIONES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fact.notificaciones (
    notif_id           BIGSERIAL    PRIMARY KEY,
    line_hash          VARCHAR(32)  NOT NULL UNIQUE,
    batch_id           VARCHAR(64)  NOT NULL,
    codigo_mat         VARCHAR(30)  /* REFERENCES dim.producto(codigo_mat) */,
    fecha              DATE         NOT NULL,
    um                 VARCHAR(10),
    sector_texto       VARCHAR(50),
    reproceso          VARCHAR(20),
    cant_notif         NUMERIC(18,3),
    libre_ut           NUMERIC(18,3),
    exist_otr          NUMERIC(18,3),
    fecha_hora         TIMESTAMPTZ,
    _loaded_at         TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_mat   ON fact.notificaciones(codigo_mat);
CREATE INDEX IF NOT EXISTS idx_notif_fecha ON fact.notificaciones(fecha);

-- ── PRECIOS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fact.precios (
    precio_id          BIGSERIAL    PRIMARY KEY,
    line_hash          VARCHAR(32)  NOT NULL UNIQUE,
    batch_id           VARCHAR(64)  NOT NULL,
    codigo_mat         VARCHAR(30)  /* REFERENCES dim.producto(codigo_mat) */,
    cod_lista_precio   VARCHAR(20),
    cl_cd              VARCHAR(10),
    org_vt             VARCHAR(10),
    lp                 VARCHAR(10),
    importe            NUMERIC(18,4),
    un                 VARCHAR(10),
    por                NUMERIC(18,3),
    valido_de          DATE,
    valido_a           DATE,
    _loaded_at         TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prec_mat    ON fact.precios(codigo_mat);
CREATE INDEX IF NOT EXISTS idx_prec_valid  ON fact.precios(valido_de, valido_a);

-- ── CUENTAS POR PAGAR (CxP) ──────────────────────────────────
-- Fuente: AVAC_PH.CSV (análisis de antigüedad proveedores)
CREATE TABLE IF NOT EXISTS fact.cxp (
    cxp_id             BIGSERIAL    PRIMARY KEY,
    line_hash          VARCHAR(32)  NOT NULL UNIQUE,
    batch_id           VARCHAR(64)  NOT NULL,
    sociedad           VARCHAR(10),
    proveedor          VARCHAR(20)  NOT NULL,
    nombre_proveedor   TEXT,
    asignacion         VARCHAR(30),
    referencia         VARCHAR(30),
    clase_doc          VARCHAR(20),
    n_documento        VARCHAR(30)  NOT NULL,
    fecha_doc          DATE,
    cod_condicion_pago VARCHAR(20),
    desc_pago          VARCHAR(100),
    d_venc             SMALLINT,
    fecha_venc         DATE,
    cod_moneda         VARCHAR(10),
    importe_ml         NUMERIC(18,2),
    por_vencer         NUMERIC(18,2),
    venc_1_30          NUMERIC(18,2),
    venc_31_60         NUMERIC(18,2),
    venc_61_90         NUMERIC(18,2),
    venc_91_mas        NUMERIC(18,2),
    importe            NUMERIC(18,2),
    importe_m          NUMERIC(18,2),
    cod_ramo           VARCHAR(20),
    ref_factura        VARCHAR(30),
    importe_moneda_fuerte NUMERIC(18,2),
    moneda_fuerte      VARCHAR(10),
    importe_mf_fecha_doc  NUMERIC(18,2),
    _loaded_at         TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cxp_prov    ON fact.cxp(proveedor);
CREATE INDEX IF NOT EXISTS idx_cxp_venc    ON fact.cxp(fecha_venc);
CREATE INDEX IF NOT EXISTS idx_cxp_doc     ON fact.cxp(n_documento);

-- ══════════════════════════════════════════════════════════════════
-- RAW — CSV sin transformar (histórico permanente)
-- Columnas TEXT = valor exacto de SAP, sin ningún parseo
-- NUNCA se modifica un registro ya insertado
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS raw.ventas (
    raw_id         BIGSERIAL    PRIMARY KEY,
    pk_hash        CHAR(32)     NOT NULL UNIQUE,
    row_hash       CHAR(32)     NOT NULL,
    -- Las 58 columnas de PHXX.CSV, todas TEXT
    razon_social TEXT, gpo_de_cliente TEXT, clase_doc TEXT,
    num_factura TEXT, sector TEXT, canal TEXT, fecha_doc TEXT,
    zona_vtas TEXT, almacen TEXT, denominacion_material TEXT,
    cantidad_umv TEXT, um_vtas TEXT, cantidad_umb TEXT, um_base TEXT,
    prec_unitario TEXT, monto_neto TEXT, iva TEXT, importe_final TEXT,
    doc_comercial TEXT, cond_pago TEXT, fec_venc TEXT, moneda_doc TEXT,
    status_anulacion TEXT, doc_anulac TEXT, grp_vend TEXT, vendedor TEXT,
    referencia TEXT, pedido_vta TEXT, jerarquia_1 TEXT, jerarquia_2 TEXT,
    jerarquia_3 TEXT, um_peso TEXT, peso_fact TEXT, peso_total TEXT,
    um_peso_gen TEXT, ramo TEXT, gr_material TEXT, gr_articulo TEXT,
    tipo_cambio TEXT, mes TEXT, ejercicio TEXT,
    prec_unitario_2 TEXT, monto_neto_2 TEXT, iva_2 TEXT, importe_final_2 TEXT,
    conc_busq TEXT, codigo_mat TEXT, listas_precios TEXT, cod_cliente TEXT,
    ind_retcl TEXT, ind_auto_retcl TEXT, fechahora TEXT,
    cod_mot TEXT, tx_motivo TEXT, cod_vend TEXT, org_vtas TEXT,
    -- Metadatos
    source_file    VARCHAR(200),
    batch_id       VARCHAR(64),
    loaded_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- Índices mínimos para auditoría
CREATE INDEX IF NOT EXISTS idx_raw_v_cliente  ON raw.ventas(cod_cliente);
CREATE INDEX IF NOT EXISTS idx_raw_v_fecha    ON raw.ventas(fecha_doc);

CREATE TABLE IF NOT EXISTS raw.clientes (
    raw_id          BIGSERIAL    PRIMARY KEY,
    pk_hash         CHAR(32)     NOT NULL UNIQUE,
    row_hash        CHAR(32)     NOT NULL,
    -- Las 34 columnas de CLIENTES.CSV incluyendo las Descripción* (redundantes en dim)
    cod_cliente TEXT, nombre_sol TEXT, cond_pago TEXT, desc_cond_pag TEXT,
    ramo TEXT, desc_ramo TEXT, gr_clientes TEXT, desc_gr_clien TEXT,
    direccion TEXT, telefono TEXT, rif TEXT, ruta_transp TEXT,
    poblacion TEXT, zona_ventas TEXT, desc_zona TEXT,
    grupo_vend TEXT, desc_grupo_ve TEXT, desc_estado TEXT,
    fecha_creacion TEXT, ag_ret TEXT, ult_fact TEXT, fecha_fact TEXT,
    doc_ult_pago TEXT, fecha_pago TEXT, nombre_contacto TEXT,
    telefono_movil TEXT, cod_vend TEXT, nombre_vendedor TEXT,
    cod_ger_reg TEXT, nombre_gte TEXT, moneda TEXT,
    lista TEXT, denominacion TEXT, canal TEXT,
    -- Metadatos
    source_file    VARCHAR(200),
    batch_id       VARCHAR(64),
    loaded_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_c_cod ON raw.clientes(cod_cliente);

-- ── RAW GENÉRICO — Todas las fuentes como JSONB ─────────────────
-- Reemplaza la necesidad de crear raw.* por cada fuente nueva.
-- Cada fila guarda el CSV completo como JSONB para auditoría.
CREATE TABLE IF NOT EXISTS raw.source_data (
    raw_id         BIGSERIAL    PRIMARY KEY,
    source_key     VARCHAR(30)  NOT NULL,
    pk_hash        CHAR(32)     NOT NULL,
    row_hash       CHAR(32)     NOT NULL,
    data           JSONB        NOT NULL,
    source_file    VARCHAR(200),
    batch_id       VARCHAR(64),
    loaded_at      TIMESTAMPTZ  DEFAULT NOW(),
    UNIQUE (source_key, pk_hash)
);

CREATE INDEX IF NOT EXISTS idx_raw_sd_source ON raw.source_data(source_key);
CREATE INDEX IF NOT EXISTS idx_raw_sd_batch  ON raw.source_data(batch_id);
CREATE INDEX IF NOT EXISTS idx_raw_sd_data   ON raw.source_data USING gin(data);

-- ══════════════════════════════════════════════════════════════════
-- ETL — Control del pipeline
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS etl.executions (
    id             SERIAL        PRIMARY KEY,
    source_key     VARCHAR(30)   NOT NULL,
    filepath       VARCHAR(500)  NOT NULL,
    file_hash      CHAR(32)      NOT NULL,
    started_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    finished_at    TIMESTAMPTZ,
    status         VARCHAR(10)   NOT NULL DEFAULT 'RUNNING',
    rows_read      INTEGER       DEFAULT 0,
    rows_inserted  INTEGER       DEFAULT 0,
    rows_updated   INTEGER       DEFAULT 0,
    rows_skipped   INTEGER       DEFAULT 0,
    rows_rejected  INTEGER       DEFAULT 0,
    error_message  TEXT
);
CREATE INDEX IF NOT EXISTS idx_exec_source ON etl.executions(source_key, started_at DESC);

CREATE TABLE IF NOT EXISTS etl.rejects (
    id             SERIAL        PRIMARY KEY,
    execution_id   INTEGER       REFERENCES etl.executions(id),
    source_key     VARCHAR(30),
    row_number     INTEGER,
    raw_data       JSONB,
    reject_reason  VARCHAR(500),
    created_at     TIMESTAMPTZ   DEFAULT NOW()
);

-- ── VISTA de estado (lo primero que mira soporte) ──────────────
CREATE OR REPLACE VIEW etl.estado AS
SELECT
    e.source_key                                            AS archivo,
    e.status                                                AS estado,
    TO_CHAR(e.finished_at, 'DD/MM/YYYY HH24:MI')          AS ultima_carga,
    e.rows_read                                             AS leidas,
    e.rows_inserted                                         AS nuevas,
    e.rows_updated                                          AS actualizadas,
    e.rows_skipped                                          AS sin_cambios,
    e.rows_rejected                                         AS rechazadas,
    CASE WHEN COALESCE(e.rows_read, 0) > 0
         THEN ROUND(e.rows_skipped::numeric / e.rows_read * 100, 0)::text || '%'
         ELSE '—' END                                       AS pct_sin_cambios,
    e.error_message                                         AS error
FROM etl.executions e
WHERE e.id = (
    SELECT MAX(id) FROM etl.executions x WHERE x.source_key = e.source_key
)
ORDER BY e.source_key;

-- ── VISTAS DE NEGOCIO para dashboards ─────────────────────────

-- Ventas con todos los nombres resueltos (para reportes)
CREATE OR REPLACE VIEW fact.v_ventas_full AS
SELECT
    v.fecha_doc,
    v.ejercicio,
    v.mes,
    v.num_factura,
    -- Cliente
    c.cod_cliente,
    c.nombre_cliente,
    c.rif                           AS rif_cliente,
    c.estado,
    zv.descripcion                  AS zona_ventas,
    r.descripcion                   AS ramo,
    -- Producto
    p.codigo_mat,
    p.denominacion_material         AS producto,
    p.categoria,
    p.marca,
    -- Vendedor
    vd.cod_vendedor,
    vd.nombre_vendedor,
    vd.tipo                         AS tipo_vendedor,
    -- Métricas
    v.cantidad_umv,
    v.um_vtas,
    v.importe_final                 AS monto_bs,
    v.tipo_cambio,
    v.importe_final_usd             AS monto_usd,
    v.iva,
    v.iva_usd,
    v.status_anulacion,
    v.canal_texto,
    v._loaded_at
FROM fact.ventas v
LEFT JOIN dim.cliente  c  ON v.cod_cliente  = c.cod_cliente
LEFT JOIN dim.producto p  ON v.codigo_mat   = p.codigo_mat
LEFT JOIN dim.vendedor vd ON v.cod_vendedor = vd.cod_vendedor
LEFT JOIN cat.zona_ventas zv ON c.cod_zona_ventas = zv.cod
LEFT JOIN cat.ramo        r  ON c.cod_ramo        = r.cod;

-- CxC con nombres resueltos
CREATE OR REPLACE VIEW fact.v_cxc_full AS
SELECT
    cx.fecha_venc,
    cx.n_documento,
    c.cod_cliente,
    c.nombre_cliente,
    c.rif                   AS rif_cliente,
    zv.descripcion          AS zona_ventas,
    vd.nombre_vendedor,
    cd.descripcion          AS clase_doc,
    cx.valor_monetario,
    cx.no_vencido,
    cx.venc_1_15,
    cx.venc_16_30,
    cx.venc_31_60,
    cx.venc_61_90,
    cx.venc_91_mas,
    cx.importe_md           AS total_usd,
    -- Deuda total vencida
    COALESCE(cx.venc_1_15,0) + COALESCE(cx.venc_16_30,0) +
    COALESCE(cx.venc_31_60,0) + COALESCE(cx.venc_61_90,0) +
    COALESCE(cx.venc_91_mas,0)  AS total_vencido_usd
FROM fact.cxc cx
LEFT JOIN dim.cliente   c  ON cx.cod_cliente   = c.cod_cliente
LEFT JOIN dim.vendedor  vd ON cx.cod_vendedor  = vd.cod_vendedor
LEFT JOIN cat.zona_ventas zv ON c.cod_zona_ventas = zv.cod
LEFT JOIN cat.clase_doc   cd ON cx.cod_clase_doc  = cd.cod;

-- Inventario disponible (solo stock libre)
CREATE OR REPLACE VIEW fact.v_inventario_disponible AS
SELECT
    i.tipo_inv,
    i.centro,
    i.almacen,
    p.codigo_mat,
    p.denominacion_material AS producto,
    p.categoria,
    p.marca,
    i.libre_ut,
    i.calidad,
    i.bloqueado,
    i.libre_ut + COALESCE(i.calidad, 0) AS total_disponible,
    i.hora_snapshot,
    i._loaded_at
FROM fact.inventario i
LEFT JOIN dim.producto p ON i.codigo_mat = p.codigo_mat
WHERE i.libre_ut > 0 OR i.calidad > 0;


-- ══════════════════════════════════════════════════════════════════
-- VISTAS PUBLIC (para herramientas BI como Looker Studio)
-- Looker Studio solo ve schema public por defecto
-- ══════════════════════════════════════════════════════════════════

-- Fact tables
CREATE OR REPLACE VIEW public.fact_ventas AS SELECT * FROM fact.ventas;
CREATE OR REPLACE VIEW public.fact_cxc AS SELECT * FROM fact.cxc;
CREATE OR REPLACE VIEW public.fact_cxp AS SELECT * FROM fact.cxp;
CREATE OR REPLACE VIEW public.fact_entregas AS SELECT * FROM fact.entregas;
CREATE OR REPLACE VIEW public.fact_pedidos AS SELECT * FROM fact.pedidos;
CREATE OR REPLACE VIEW public.fact_consumos AS SELECT * FROM fact.consumos;
CREATE OR REPLACE VIEW public.fact_notificaciones AS SELECT * FROM fact.notificaciones;
CREATE OR REPLACE VIEW public.fact_inventario AS SELECT * FROM fact.inventario;
CREATE OR REPLACE VIEW public.fact_ordenes AS SELECT * FROM fact.ordenes;
CREATE OR REPLACE VIEW public.fact_precios AS SELECT * FROM fact.precios;

-- Dimensiones
CREATE OR REPLACE VIEW public.dim_cliente AS SELECT * FROM dim.cliente;
CREATE OR REPLACE VIEW public.dim_vendedor AS SELECT * FROM dim.vendedor;
CREATE OR REPLACE VIEW public.dim_producto AS SELECT * FROM dim.producto;

-- Catálogos
CREATE OR REPLACE VIEW public.cat_canal AS SELECT * FROM cat.canal;
CREATE OR REPLACE VIEW public.cat_clase_doc AS SELECT * FROM cat.clase_doc;
CREATE OR REPLACE VIEW public.cat_clase_orden AS SELECT * FROM cat.clase_orden;
CREATE OR REPLACE VIEW public.cat_condicion_pago AS SELECT * FROM cat.condicion_pago;
CREATE OR REPLACE VIEW public.cat_gpo_cliente AS SELECT * FROM cat.gpo_cliente;
CREATE OR REPLACE VIEW public.cat_grp_vendedor AS SELECT * FROM cat.grp_vendedor;
CREATE OR REPLACE VIEW public.cat_lista_precio AS SELECT * FROM cat.lista_precio;
CREATE OR REPLACE VIEW public.cat_ramo AS SELECT * FROM cat.ramo;
CREATE OR REPLACE VIEW public.cat_sector AS SELECT * FROM cat.sector;
CREATE OR REPLACE VIEW public.cat_zona_ventas AS SELECT * FROM cat.zona_ventas;

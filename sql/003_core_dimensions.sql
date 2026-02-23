-- 003_core_dimensions.sql: Tablas de dimensiones en core

-- ============================================================
-- dim_cliente: campos propios del cliente + solo codigos (FKs)
-- Las descripciones se obtienen via JOIN a dim_condicion_pago,
-- dim_ramo, dim_gpo_cliente, dim_zona_ventas, dim_grp_vend,
-- dim_vendedor, dim_lista_precio, dim_moneda, dim_canal
-- ============================================================
CREATE TABLE IF NOT EXISTS core.dim_cliente (
    dim_cliente_id          SERIAL          PRIMARY KEY,
    cod_cliente             VARCHAR(20)     NOT NULL UNIQUE,
    nombre_cliente          TEXT,
    -- Codigos FK (descripciones en tablas catalogo)
    cod_condicion_pago      VARCHAR(20),
    cod_ramo_cliente        VARCHAR(20),
    cod_grupo_cliente       VARCHAR(20),
    cod_zona_ventas         VARCHAR(20),
    cod_grupo_vendedor      VARCHAR(20),
    cod_vendedor            VARCHAR(20),
    cod_gerente_regional    VARCHAR(20),
    cod_moneda              VARCHAR(10),
    cod_lista_precio_cliente VARCHAR(20),
    cod_canal_cliente       VARCHAR(20),
    -- Campos propios del cliente (sin duplicidad)
    direccion               TEXT,
    telefono_fijo           VARCHAR(50),
    rif                     VARCHAR(30),
    cod_ruta_transporte     VARCHAR(30),
    poblacion               TEXT,
    estado                  TEXT,
    fecha_creacion_cliente  DATE,
    agente_retencion_flag   BOOLEAN,
    num_ultima_factura      VARCHAR(30),
    fecha_ultima_factura    DATE,
    num_ultimo_pago         VARCHAR(30),
    fecha_ultimo_pago       DATE,
    nombre_contacto         TEXT,
    telefono_movil_contacto VARCHAR(50),
    fecha_corte_archivo     DATE,
    dias_sin_facturar       INTEGER,
    -- Control
    is_placeholder          BOOLEAN         NOT NULL DEFAULT FALSE,
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    _batch_id               VARCHAR(64),
    _created_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    _updated_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ============================================================
-- dim_producto
-- ============================================================
CREATE TABLE IF NOT EXISTS core.dim_producto (
    dim_producto_id         SERIAL          PRIMARY KEY,
    codigo_mat              VARCHAR(20)     NOT NULL UNIQUE,
    denominacion_material   TEXT            NOT NULL,
    jerarquia_1             TEXT,
    jerarquia_2             TEXT,
    jerarquia_3             TEXT,
    sector                  TEXT,
    gr_material             TEXT,
    gr_articulo             TEXT,
    _batch_id               VARCHAR(64),
    _created_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    _updated_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ============================================================
-- dim_vendedor
-- ============================================================
CREATE TABLE IF NOT EXISTS core.dim_vendedor (
    dim_vendedor_id         SERIAL          PRIMARY KEY,
    cod_vendedor            VARCHAR(20)     NOT NULL UNIQUE,
    nombre_vendedor         TEXT,
    _batch_id               VARCHAR(64),
    _created_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    _updated_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ============================================================
-- dim_condicion_pago
-- ============================================================
CREATE TABLE IF NOT EXISTS core.dim_condicion_pago (
    dim_condicion_pago_id   SERIAL          PRIMARY KEY,
    cod_condicion_pago      VARCHAR(20)     NOT NULL UNIQUE,
    desc_condicion_pago     TEXT,
    _batch_id               VARCHAR(64),
    _created_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    _updated_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ============================================================
-- dim_moneda
-- ============================================================
CREATE TABLE IF NOT EXISTS core.dim_moneda (
    dim_moneda_id           SERIAL          PRIMARY KEY,
    cod_moneda              VARCHAR(10)     NOT NULL UNIQUE,
    desc_moneda             TEXT,
    _batch_id               VARCHAR(64),
    _created_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    _updated_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 12 catalogos estandar (estructura comun)
-- ============================================================

CREATE TABLE IF NOT EXISTS core.dim_gpo_cliente (
    dim_gpo_cliente_id      SERIAL          PRIMARY KEY,
    codigo                  VARCHAR(20)     NOT NULL UNIQUE,
    valor_origen            TEXT            NOT NULL,
    valor_normalizado       TEXT            NOT NULL,
    es_mock                 BOOLEAN         NOT NULL DEFAULT TRUE,
    _batch_id               VARCHAR(64),
    _created_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    _updated_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS core.dim_clase_doc (
    dim_clase_doc_id        SERIAL          PRIMARY KEY,
    codigo                  VARCHAR(20)     NOT NULL UNIQUE,
    valor_origen            TEXT            NOT NULL,
    valor_normalizado       TEXT            NOT NULL,
    es_mock                 BOOLEAN         NOT NULL DEFAULT TRUE,
    _batch_id               VARCHAR(64),
    _created_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    _updated_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS core.dim_sector (
    dim_sector_id           SERIAL          PRIMARY KEY,
    codigo                  VARCHAR(20)     NOT NULL UNIQUE,
    valor_origen            TEXT            NOT NULL,
    valor_normalizado       TEXT            NOT NULL,
    es_mock                 BOOLEAN         NOT NULL DEFAULT TRUE,
    _batch_id               VARCHAR(64),
    _created_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    _updated_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS core.dim_canal (
    dim_canal_id            SERIAL          PRIMARY KEY,
    codigo                  VARCHAR(20)     NOT NULL UNIQUE,
    valor_origen            TEXT            NOT NULL,
    valor_normalizado       TEXT            NOT NULL,
    es_mock                 BOOLEAN         NOT NULL DEFAULT TRUE,
    _batch_id               VARCHAR(64),
    _created_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    _updated_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS core.dim_zona_ventas (
    dim_zona_ventas_id      SERIAL          PRIMARY KEY,
    codigo                  VARCHAR(20)     NOT NULL UNIQUE,
    valor_origen            TEXT            NOT NULL,
    valor_normalizado       TEXT            NOT NULL,
    es_mock                 BOOLEAN         NOT NULL DEFAULT TRUE,
    _batch_id               VARCHAR(64),
    _created_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    _updated_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS core.dim_doc_comercial (
    dim_doc_comercial_id    SERIAL          PRIMARY KEY,
    codigo                  VARCHAR(20)     NOT NULL UNIQUE,
    valor_origen            TEXT            NOT NULL,
    valor_normalizado       TEXT            NOT NULL,
    es_mock                 BOOLEAN         NOT NULL DEFAULT TRUE,
    _batch_id               VARCHAR(64),
    _created_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    _updated_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS core.dim_grp_vend (
    dim_grp_vend_id         SERIAL          PRIMARY KEY,
    codigo                  VARCHAR(20)     NOT NULL UNIQUE,
    valor_origen            TEXT            NOT NULL,
    valor_normalizado       TEXT            NOT NULL,
    es_mock                 BOOLEAN         NOT NULL DEFAULT TRUE,
    _batch_id               VARCHAR(64),
    _created_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    _updated_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS core.dim_ramo (
    dim_ramo_id             SERIAL          PRIMARY KEY,
    codigo                  VARCHAR(20)     NOT NULL UNIQUE,
    valor_origen            TEXT            NOT NULL,
    valor_normalizado       TEXT            NOT NULL,
    es_mock                 BOOLEAN         NOT NULL DEFAULT TRUE,
    _batch_id               VARCHAR(64),
    _created_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    _updated_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS core.dim_gr_material (
    dim_gr_material_id      SERIAL          PRIMARY KEY,
    codigo                  VARCHAR(20)     NOT NULL UNIQUE,
    valor_origen            TEXT            NOT NULL,
    valor_normalizado       TEXT            NOT NULL,
    es_mock                 BOOLEAN         NOT NULL DEFAULT TRUE,
    _batch_id               VARCHAR(64),
    _created_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    _updated_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS core.dim_gr_articulo (
    dim_gr_articulo_id      SERIAL          PRIMARY KEY,
    codigo                  VARCHAR(20)     NOT NULL UNIQUE,
    valor_origen            TEXT            NOT NULL,
    valor_normalizado       TEXT            NOT NULL,
    es_mock                 BOOLEAN         NOT NULL DEFAULT TRUE,
    _batch_id               VARCHAR(64),
    _created_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    _updated_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS core.dim_lista_precio (
    dim_lista_precio_id     SERIAL          PRIMARY KEY,
    codigo                  VARCHAR(20)     NOT NULL UNIQUE,
    valor_origen            TEXT            NOT NULL,
    valor_normalizado       TEXT            NOT NULL,
    es_mock                 BOOLEAN         NOT NULL DEFAULT TRUE,
    _batch_id               VARCHAR(64),
    _created_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    _updated_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS core.dim_tx_motivo (
    dim_tx_motivo_id        SERIAL          PRIMARY KEY,
    codigo                  VARCHAR(20)     NOT NULL UNIQUE,
    valor_origen            TEXT            NOT NULL,
    valor_normalizado       TEXT            NOT NULL,
    es_mock                 BOOLEAN         NOT NULL DEFAULT TRUE,
    _batch_id               VARCHAR(64),
    _created_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    _updated_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- 005_control_tables.sql: Tablas de control ETL

CREATE TABLE IF NOT EXISTS core.etl_batch (
    batch_id        VARCHAR(64)     PRIMARY KEY,
    started_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    finished_at     TIMESTAMPTZ,
    status          VARCHAR(20)     NOT NULL DEFAULT 'RUNNING',
    clientes_file   TEXT,
    ventas_file     TEXT,
    error_message   TEXT
);

CREATE TABLE IF NOT EXISTS core.etl_rejects (
    reject_id       BIGSERIAL       PRIMARY KEY,
    batch_id        VARCHAR(64)     NOT NULL REFERENCES core.etl_batch(batch_id),
    table_source    VARCHAR(50)     NOT NULL,
    row_number      INTEGER,
    row_data        JSONB,
    reasons         TEXT[],
    rejected_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS core.etl_warnings (
    warning_id      BIGSERIAL       PRIMARY KEY,
    batch_id        VARCHAR(64)     NOT NULL REFERENCES core.etl_batch(batch_id),
    table_source    VARCHAR(50)     NOT NULL,
    row_number      INTEGER,
    field_name      VARCHAR(100),
    message         TEXT,
    warned_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS core.etl_metrics (
    metric_id       BIGSERIAL       PRIMARY KEY,
    batch_id        VARCHAR(64)     NOT NULL REFERENCES core.etl_batch(batch_id),
    metric_name     VARCHAR(100)    NOT NULL,
    metric_value    NUMERIC,
    measured_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS core.map_catalogo_valor (
    catalogo_id         BIGSERIAL       PRIMARY KEY,
    dominio             VARCHAR(50)     NOT NULL,
    valor_origen        TEXT            NOT NULL,
    valor_normalizado   TEXT            NOT NULL,
    codigo_generado     VARCHAR(20)     NOT NULL,
    _batch_id           VARCHAR(64),
    _created_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (dominio, valor_normalizado)
);

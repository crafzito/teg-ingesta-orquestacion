-- 004_core_fact.sql: Tabla de hechos particionada

CREATE TABLE IF NOT EXISTS core.fact_venta_linea (
    fact_venta_linea_id     BIGSERIAL,
    line_hash               VARCHAR(32)     NOT NULL,
    batch_id                VARCHAR(64)     NOT NULL,

    -- Foreign keys a dimensiones
    dim_cliente_id          INTEGER         REFERENCES core.dim_cliente(dim_cliente_id),
    dim_producto_id         INTEGER         REFERENCES core.dim_producto(dim_producto_id),
    dim_vendedor_id         INTEGER         REFERENCES core.dim_vendedor(dim_vendedor_id),
    dim_condicion_pago_id   INTEGER         REFERENCES core.dim_condicion_pago(dim_condicion_pago_id),
    dim_moneda_id           INTEGER         REFERENCES core.dim_moneda(dim_moneda_id),
    dim_gpo_cliente_id      INTEGER         REFERENCES core.dim_gpo_cliente(dim_gpo_cliente_id),
    dim_clase_doc_id        INTEGER         REFERENCES core.dim_clase_doc(dim_clase_doc_id),
    dim_sector_id           INTEGER         REFERENCES core.dim_sector(dim_sector_id),
    dim_canal_id            INTEGER         REFERENCES core.dim_canal(dim_canal_id),
    dim_zona_ventas_id      INTEGER         REFERENCES core.dim_zona_ventas(dim_zona_ventas_id),
    dim_doc_comercial_id    INTEGER         REFERENCES core.dim_doc_comercial(dim_doc_comercial_id),
    dim_grp_vend_id         INTEGER         REFERENCES core.dim_grp_vend(dim_grp_vend_id),
    dim_ramo_id             INTEGER         REFERENCES core.dim_ramo(dim_ramo_id),
    dim_gr_material_id      INTEGER         REFERENCES core.dim_gr_material(dim_gr_material_id),
    dim_gr_articulo_id      INTEGER         REFERENCES core.dim_gr_articulo(dim_gr_articulo_id),
    dim_lista_precio_id     INTEGER         REFERENCES core.dim_lista_precio(dim_lista_precio_id),
    dim_tx_motivo_id        INTEGER         REFERENCES core.dim_tx_motivo(dim_tx_motivo_id),

    -- Dimensiones degeneradas (no ameritan tabla propia)
    num_factura             VARCHAR(30),
    referencia              VARCHAR(30),
    pedido_vta              VARCHAR(30),
    almacen                 VARCHAR(10),
    conc_busq               VARCHAR(30),
    cod_lista_precio_origen VARCHAR(10),
    cod_mot                 VARCHAR(10),
    status_anulacion        VARCHAR(10),
    ind_retcl               VARCHAR(10),
    ind_auto_retcl          VARCHAR(10),

    -- Fechas
    fecha_doc               DATE            NOT NULL,
    fec_venc                DATE,
    fechahora               TIMESTAMPTZ,

    -- Medidas monetarias (moneda local)
    cantidad_umv            NUMERIC(18,4),
    um_vtas                 VARCHAR(10),
    cantidad_umb            NUMERIC(18,4),
    um_base                 VARCHAR(10),
    prec_unitario           NUMERIC(18,4),
    monto_neto              NUMERIC(18,4),
    iva                     NUMERIC(18,4),
    importe_final           NUMERIC(18,4),

    -- Medidas monetarias (segunda moneda / USD)
    tipo_cambio             NUMERIC(18,6),
    prec_unitario_2         NUMERIC(18,4),
    monto_neto_2            NUMERIC(18,4),
    iva_2                   NUMERIC(18,4),
    importe_final_2         NUMERIC(18,4),

    -- Peso
    peso_fact               NUMERIC(18,4),
    um_peso                 VARCHAR(10),
    um_peso_gen             VARCHAR(20),

    -- Periodo
    mes                     SMALLINT,
    ejercicio               SMALLINT,

    -- Meta
    _row_number             INTEGER,
    _loaded_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    PRIMARY KEY (fact_venta_linea_id, fecha_doc),
    UNIQUE (line_hash, batch_id, fecha_doc)
) PARTITION BY RANGE (fecha_doc);

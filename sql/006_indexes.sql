-- 006_indexes.sql: Indices para rendimiento

-- dim_cliente
CREATE INDEX IF NOT EXISTS idx_dim_cliente_zona ON core.dim_cliente(cod_zona_ventas);
CREATE INDEX IF NOT EXISTS idx_dim_cliente_canal ON core.dim_cliente(cod_canal_cliente);
CREATE INDEX IF NOT EXISTS idx_dim_cliente_vendedor ON core.dim_cliente(cod_vendedor);
CREATE INDEX IF NOT EXISTS idx_dim_cliente_ramo ON core.dim_cliente(cod_ramo_cliente);
CREATE INDEX IF NOT EXISTS idx_dim_cliente_estado ON core.dim_cliente(estado);

-- fact_venta_linea: FKs
CREATE INDEX IF NOT EXISTS idx_fact_vl_cliente ON core.fact_venta_linea(dim_cliente_id);
CREATE INDEX IF NOT EXISTS idx_fact_vl_producto ON core.fact_venta_linea(dim_producto_id);
CREATE INDEX IF NOT EXISTS idx_fact_vl_vendedor ON core.fact_venta_linea(dim_vendedor_id);
CREATE INDEX IF NOT EXISTS idx_fact_vl_condpago ON core.fact_venta_linea(dim_condicion_pago_id);
CREATE INDEX IF NOT EXISTS idx_fact_vl_moneda ON core.fact_venta_linea(dim_moneda_id);
CREATE INDEX IF NOT EXISTS idx_fact_vl_gpo_cli ON core.fact_venta_linea(dim_gpo_cliente_id);
CREATE INDEX IF NOT EXISTS idx_fact_vl_clasedoc ON core.fact_venta_linea(dim_clase_doc_id);
CREATE INDEX IF NOT EXISTS idx_fact_vl_sector ON core.fact_venta_linea(dim_sector_id);
CREATE INDEX IF NOT EXISTS idx_fact_vl_canal ON core.fact_venta_linea(dim_canal_id);
CREATE INDEX IF NOT EXISTS idx_fact_vl_zona ON core.fact_venta_linea(dim_zona_ventas_id);
CREATE INDEX IF NOT EXISTS idx_fact_vl_doccom ON core.fact_venta_linea(dim_doc_comercial_id);
CREATE INDEX IF NOT EXISTS idx_fact_vl_grpvend ON core.fact_venta_linea(dim_grp_vend_id);
CREATE INDEX IF NOT EXISTS idx_fact_vl_ramo ON core.fact_venta_linea(dim_ramo_id);
CREATE INDEX IF NOT EXISTS idx_fact_vl_grmat ON core.fact_venta_linea(dim_gr_material_id);
CREATE INDEX IF NOT EXISTS idx_fact_vl_grart ON core.fact_venta_linea(dim_gr_articulo_id);
CREATE INDEX IF NOT EXISTS idx_fact_vl_listapre ON core.fact_venta_linea(dim_lista_precio_id);
CREATE INDEX IF NOT EXISTS idx_fact_vl_txmot ON core.fact_venta_linea(dim_tx_motivo_id);

-- fact_venta_linea: patrones de consulta
CREATE INDEX IF NOT EXISTS idx_fact_vl_fecha ON core.fact_venta_linea(fecha_doc);
CREATE INDEX IF NOT EXISTS idx_fact_vl_cli_fecha ON core.fact_venta_linea(dim_cliente_id, fecha_doc);
CREATE INDEX IF NOT EXISTS idx_fact_vl_prod_fecha ON core.fact_venta_linea(dim_producto_id, fecha_doc);
CREATE INDEX IF NOT EXISTS idx_fact_vl_vend_fecha ON core.fact_venta_linea(dim_vendedor_id, fecha_doc);
CREATE INDEX IF NOT EXISTS idx_fact_vl_factura ON core.fact_venta_linea(num_factura);
CREATE INDEX IF NOT EXISTS idx_fact_vl_batch ON core.fact_venta_linea(batch_id);

-- Control
CREATE INDEX IF NOT EXISTS idx_rejects_batch ON core.etl_rejects(batch_id);
CREATE INDEX IF NOT EXISTS idx_warnings_batch ON core.etl_warnings(batch_id);
CREATE INDEX IF NOT EXISTS idx_metrics_batch ON core.etl_metrics(batch_id);
CREATE INDEX IF NOT EXISTS idx_catalogo_dominio ON core.map_catalogo_valor(dominio);
CREATE INDEX IF NOT EXISTS idx_catalogo_dom_norm ON core.map_catalogo_valor(dominio, valor_normalizado);

-- Staging clean (para joins durante upsert)
CREATE INDEX IF NOT EXISTS idx_stg_cli_clean_cod ON staging.stg_clientes_clean(cod_cliente);
CREATE INDEX IF NOT EXISTS idx_stg_cli_clean_batch ON staging.stg_clientes_clean(_batch_id);
CREATE INDEX IF NOT EXISTS idx_stg_ven_clean_cod ON staging.stg_ventas_clean(cod_cliente);
CREATE INDEX IF NOT EXISTS idx_stg_ven_clean_mat ON staging.stg_ventas_clean(codigo_mat);
CREATE INDEX IF NOT EXISTS idx_stg_ven_clean_batch ON staging.stg_ventas_clean(_batch_id);

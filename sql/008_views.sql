-- 008_views.sql: Vistas de consumo

-- ============================================================
-- vw_ventas_detalle: fact + joins a todas las dimensiones principales
-- ============================================================
CREATE OR REPLACE VIEW core.vw_ventas_detalle AS
SELECT
    f.fact_venta_linea_id,
    f.fecha_doc,
    f.fec_venc,
    f.num_factura,
    f.batch_id,
    -- Cliente
    c.cod_cliente,
    c.nombre_cliente,
    c.rif,
    c.is_placeholder AS cliente_es_placeholder,
    -- Producto
    p.codigo_mat,
    p.denominacion_material,
    p.jerarquia_1   AS marca,
    p.jerarquia_2,
    p.jerarquia_3,
    -- Vendedor
    v.cod_vendedor,
    v.nombre_vendedor,
    -- Catalogos
    gc.valor_origen  AS gpo_cliente,
    cd.valor_origen  AS clase_doc,
    se.valor_origen  AS sector,
    cn.valor_origen  AS canal,
    zv.valor_origen  AS zona_ventas,
    dc.valor_origen  AS doc_comercial,
    gv.valor_origen  AS grp_vend,
    ra.valor_origen  AS ramo,
    gm.valor_origen  AS gr_material,
    ga.valor_origen  AS gr_articulo,
    lp.valor_origen  AS lista_precio,
    tm.valor_origen  AS tx_motivo,
    cp.cod_condicion_pago,
    cp.desc_condicion_pago,
    mo.cod_moneda,
    -- Medidas
    f.cantidad_umv,
    f.um_vtas,
    f.cantidad_umb,
    f.um_base,
    f.prec_unitario,
    f.monto_neto,
    f.iva,
    f.importe_final,
    f.tipo_cambio,
    f.prec_unitario_2,
    f.monto_neto_2,
    f.iva_2,
    f.importe_final_2,
    f.peso_fact,
    f.um_peso,
    f.mes,
    f.ejercicio,
    -- Degenerate
    f.almacen,
    f.referencia,
    f.pedido_vta,
    f.conc_busq,
    f.cod_lista_precio_origen,
    f.status_anulacion,
    f.fechahora
FROM core.fact_venta_linea f
LEFT JOIN core.dim_cliente c        ON f.dim_cliente_id = c.dim_cliente_id
LEFT JOIN core.dim_producto p       ON f.dim_producto_id = p.dim_producto_id
LEFT JOIN core.dim_vendedor v       ON f.dim_vendedor_id = v.dim_vendedor_id
LEFT JOIN core.dim_gpo_cliente gc   ON f.dim_gpo_cliente_id = gc.dim_gpo_cliente_id
LEFT JOIN core.dim_clase_doc cd     ON f.dim_clase_doc_id = cd.dim_clase_doc_id
LEFT JOIN core.dim_sector se       ON f.dim_sector_id = se.dim_sector_id
LEFT JOIN core.dim_canal cn         ON f.dim_canal_id = cn.dim_canal_id
LEFT JOIN core.dim_zona_ventas zv   ON f.dim_zona_ventas_id = zv.dim_zona_ventas_id
LEFT JOIN core.dim_doc_comercial dc ON f.dim_doc_comercial_id = dc.dim_doc_comercial_id
LEFT JOIN core.dim_grp_vend gv      ON f.dim_grp_vend_id = gv.dim_grp_vend_id
LEFT JOIN core.dim_ramo ra          ON f.dim_ramo_id = ra.dim_ramo_id
LEFT JOIN core.dim_gr_material gm   ON f.dim_gr_material_id = gm.dim_gr_material_id
LEFT JOIN core.dim_gr_articulo ga   ON f.dim_gr_articulo_id = ga.dim_gr_articulo_id
LEFT JOIN core.dim_lista_precio lp  ON f.dim_lista_precio_id = lp.dim_lista_precio_id
LEFT JOIN core.dim_tx_motivo tm     ON f.dim_tx_motivo_id = tm.dim_tx_motivo_id
LEFT JOIN core.dim_condicion_pago cp ON f.dim_condicion_pago_id = cp.dim_condicion_pago_id
LEFT JOIN core.dim_moneda mo        ON f.dim_moneda_id = mo.dim_moneda_id;

-- ============================================================
-- vw_ventas_filtros: campos tipicos de busqueda (mas ligera)
-- ============================================================
CREATE OR REPLACE VIEW core.vw_ventas_filtros AS
SELECT
    f.fact_venta_linea_id,
    f.fecha_doc,
    f.num_factura,
    c.cod_cliente,
    c.nombre_cliente,
    p.codigo_mat,
    p.denominacion_material,
    cn.valor_origen  AS canal,
    zv.valor_origen  AS zona_ventas,
    gc.valor_origen  AS gpo_cliente,
    v.cod_vendedor,
    v.nombre_vendedor,
    mo.cod_moneda,
    f.importe_final,
    f.importe_final_2,
    f.mes,
    f.ejercicio,
    f.batch_id
FROM core.fact_venta_linea f
LEFT JOIN core.dim_cliente c        ON f.dim_cliente_id = c.dim_cliente_id
LEFT JOIN core.dim_producto p       ON f.dim_producto_id = p.dim_producto_id
LEFT JOIN core.dim_vendedor v       ON f.dim_vendedor_id = v.dim_vendedor_id
LEFT JOIN core.dim_gpo_cliente gc   ON f.dim_gpo_cliente_id = gc.dim_gpo_cliente_id
LEFT JOIN core.dim_canal cn         ON f.dim_canal_id = cn.dim_canal_id
LEFT JOIN core.dim_zona_ventas zv   ON f.dim_zona_ventas_id = zv.dim_zona_ventas_id
LEFT JOIN core.dim_moneda mo        ON f.dim_moneda_id = mo.dim_moneda_id;

-- ============================================================
-- vw_calidad_lotes: reporte de calidad por lote
-- ============================================================
CREATE OR REPLACE VIEW core.vw_calidad_lotes AS
SELECT
    b.batch_id,
    b.started_at,
    b.finished_at,
    b.status,
    b.clientes_file,
    b.ventas_file,
    b.error_message,
    COALESCE(r.total_rejects, 0)    AS total_rejects,
    COALESCE(w.total_warnings, 0)   AS total_warnings,
    m_rc.metric_value               AS rows_raw_clientes,
    m_rv.metric_value               AS rows_raw_ventas,
    m_cc.metric_value               AS rows_clean_clientes,
    m_cv.metric_value               AS rows_clean_ventas,
    m_f.metric_value                AS rows_fact,
    m_d.metric_value                AS duration_seconds
FROM core.etl_batch b
LEFT JOIN (
    SELECT batch_id, COUNT(*) AS total_rejects
    FROM core.etl_rejects GROUP BY batch_id
) r ON b.batch_id = r.batch_id
LEFT JOIN (
    SELECT batch_id, COUNT(*) AS total_warnings
    FROM core.etl_warnings GROUP BY batch_id
) w ON b.batch_id = w.batch_id
LEFT JOIN core.etl_metrics m_rc ON b.batch_id = m_rc.batch_id AND m_rc.metric_name = 'rows_raw_clientes'
LEFT JOIN core.etl_metrics m_rv ON b.batch_id = m_rv.batch_id AND m_rv.metric_name = 'rows_raw_ventas'
LEFT JOIN core.etl_metrics m_cc ON b.batch_id = m_cc.batch_id AND m_cc.metric_name = 'rows_clean_clientes'
LEFT JOIN core.etl_metrics m_cv ON b.batch_id = m_cv.batch_id AND m_cv.metric_name = 'rows_clean_ventas'
LEFT JOIN core.etl_metrics m_f  ON b.batch_id = m_f.batch_id  AND m_f.metric_name  = 'rows_fact'
LEFT JOIN core.etl_metrics m_d  ON b.batch_id = m_d.batch_id  AND m_d.metric_name  = 'duration_seconds';

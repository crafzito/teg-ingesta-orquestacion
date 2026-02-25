-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  Custom Queries para Looker Studio                             ║
-- ║  Copiar cada query en la fuente de datos correspondiente       ║
-- ║  (Editar conexión → CONSULTA PERSONALIZADA)                    ║
-- ║                                                                ║
-- ║  Tablas base: fact.* + dim.* + cat.*  (NO se crean vistas)     ║
-- ╚══════════════════════════════════════════════════════════════════╝


-- ═══════════════════════════════════════════════════════
-- 1. VENTAS  (Página: Ventas)
-- ═══════════════════════════════════════════════════════

SELECT
    v.fecha_doc,
    v.ejercicio,
    v.mes,
    TO_CHAR(v.fecha_doc, 'YYYY-MM')            AS anio_mes,
    v.num_factura,
    v.clase_doc,
    v.status_anulacion,
    v.canal_texto                               AS canal,
    v.almacen,
    v.cod_cliente,
    COALESCE(NULLIF(c.nombre_cliente, ''), '[SIN NOMBRE] ' || v.cod_cliente)  AS nombre_cliente,
    COALESCE(c.estado, 'N/D')                   AS estado_cliente,
    COALESCE(c.poblacion, 'N/D')                AS ciudad_cliente,
    COALESCE(zv.descripcion, 'N/D')             AS zona_ventas,
    COALESCE(r.descripcion, 'N/D')              AS ramo,
    COALESCE(gc.descripcion, 'N/D')             AS grupo_cliente,
    COALESCE(cp.descripcion, 'N/D')             AS condicion_pago,
    COALESCE(g.nombre_vendedor, 'N/D')          AS gerente,
    v.codigo_mat,
    COALESCE(p.denominacion_material, v.codigo_mat) AS producto,
    COALESCE(p.categoria, 'N/D')                AS categoria,
    COALESCE(p.marca, 'N/D')                    AS marca,
    v.cod_vendedor,
    COALESCE(vd.nombre_vendedor, 'N/D')         AS vendedor,
    v.cantidad_umv                              AS cantidad,
    v.prec_unitario,
    v.monto_neto,
    v.iva,
    v.importe_final,
    v.tipo_cambio,
    v.prec_unitario_usd,
    v.monto_neto_usd,
    v.iva_usd,
    v.importe_final_usd,
    v.peso_fact
FROM fact.ventas v
LEFT JOIN dim.cliente   c  ON v.cod_cliente  = c.cod_cliente
LEFT JOIN dim.producto  p  ON v.codigo_mat   = p.codigo_mat
LEFT JOIN dim.vendedor  vd ON v.cod_vendedor = vd.cod_vendedor
LEFT JOIN dim.vendedor  g  ON c.cod_gerente  = g.cod_vendedor
LEFT JOIN cat.zona_ventas    zv ON c.cod_zona_ventas    = zv.cod
LEFT JOIN cat.ramo           r  ON c.cod_ramo           = r.cod
LEFT JOIN cat.gpo_cliente    gc ON c.cod_gpo_cliente    = gc.cod
LEFT JOIN cat.condicion_pago cp ON c.cod_condicion_pago = cp.cod


-- ═══════════════════════════════════════════════════════
-- 2. COBRANZA / CXC  (Página: Cobranza)
-- ═══════════════════════════════════════════════════════

SELECT
    cx.sociedad,
    cx.fecha_doc,
    cx.fecha_venc,
    cx.n_documento,
    cx.cod_cliente,
    COALESCE(NULLIF(c.nombre_cliente, ''), '[SIN NOMBRE] ' || cx.cod_cliente) AS nombre_cliente,
    COALESCE(c.estado, 'N/D')                   AS estado_cliente,
    COALESCE(zv.descripcion, 'N/D')             AS zona_ventas,
    cx.cod_vendedor,
    COALESCE(vd.nombre_vendedor, 'N/D')         AS vendedor,
    COALESCE(cd.descripcion, cx.cod_clase_doc)  AS clase_doc,
    cx.cod_moneda,
    COALESCE(cx.no_vencido, 0)                  AS vigente,
    COALESCE(cx.venc_1_15, 0)                   AS venc_1_15,
    COALESCE(cx.venc_16_30, 0)                  AS venc_16_30,
    COALESCE(cx.venc_31_60, 0)                  AS venc_31_60,
    COALESCE(cx.venc_61_90, 0)                  AS venc_61_90,
    COALESCE(cx.venc_91_mas, 0)                 AS venc_91_mas,
    COALESCE(cx.venc_1_15,0) + COALESCE(cx.venc_16_30,0)   AS vencido_1_30,
    COALESCE(cx.venc_1_15,0) + COALESCE(cx.venc_16_30,0)
    + COALESCE(cx.venc_31_60,0) + COALESCE(cx.venc_61_90,0)
    + COALESCE(cx.venc_91_mas,0)                AS total_vencido,
    COALESCE(cx.no_vencido,0)
    + COALESCE(cx.venc_1_15,0) + COALESCE(cx.venc_16_30,0)
    + COALESCE(cx.venc_31_60,0) + COALESCE(cx.venc_61_90,0)
    + COALESCE(cx.venc_91_mas,0)                AS total_bs,
    cx.importe_md                               AS total_usd
FROM fact.cxc cx
LEFT JOIN dim.cliente      c  ON cx.cod_cliente    = c.cod_cliente
LEFT JOIN dim.vendedor     vd ON cx.cod_vendedor   = vd.cod_vendedor
LEFT JOIN cat.zona_ventas  zv ON c.cod_zona_ventas = zv.cod
LEFT JOIN cat.clase_doc    cd ON cx.cod_clase_doc  = cd.cod


-- ═══════════════════════════════════════════════════════
-- 3. PEDIDOS  (Página: Pedidos)
-- ═══════════════════════════════════════════════════════

SELECT
    pe.fecha_doc,
    pe.fe_entrega                               AS fecha_entrega,
    pe.creado_el                                AS fecha_creacion,
    pe.num_pedido,
    pe.doc_comer,
    pe.status,
    pe.clase_vt,
    pe.almacen,
    pe.es_mes_actual,
    pe.cod_cliente,
    COALESCE(NULLIF(c.nombre_cliente, ''), '[SIN NOMBRE] ' || pe.cod_cliente) AS nombre_cliente,
    COALESCE(c.estado, 'N/D')                   AS estado_cliente,
    pe.codigo_mat,
    COALESCE(p.denominacion_material, pe.codigo_mat) AS producto,
    COALESCE(p.categoria, 'N/D')                AS categoria,
    COALESCE(p.marca, 'N/D')                    AS marca,
    pe.ctd_ped                                  AS cantidad_pedida,
    pe.ctd_conf                                 AS cantidad_confirmada,
    pe.prc_neto                                 AS precio_neto,
    pe.valor_neto,
    pe.neto,
    pe.tp_cambio                                AS tipo_cambio
FROM fact.pedidos pe
LEFT JOIN dim.cliente  c ON pe.cod_cliente = c.cod_cliente
LEFT JOIN dim.producto p ON pe.codigo_mat  = p.codigo_mat


-- ═══════════════════════════════════════════════════════
-- 4. INVENTARIO  (Página: Inventario)
-- ═══════════════════════════════════════════════════════

SELECT
    i.tipo_inv,
    i.centro,
    i.almacen,
    i.desc_almacen,
    i.desc_centro,
    i.codigo_mat,
    COALESCE(p.denominacion_material, i.codigo_mat) AS producto,
    COALESCE(p.categoria, 'N/D')                AS categoria,
    COALESCE(p.marca, 'N/D')                    AS marca,
    COALESCE(i.libre_ut, 0)                     AS libre_ut,
    COALESCE(i.calidad, 0)                      AS calidad,
    COALESCE(i.bloqueado, 0)                    AS bloqueado,
    COALESCE(i.libre_ut,0) + COALESCE(i.calidad,0)   AS total_disponible,
    COALESCE(i.libre_ut,0) + COALESCE(i.calidad,0)
    + COALESCE(i.bloqueado,0)                   AS stock_total,
    COALESCE(i.valor_libre, 0)                  AS valor_libre,
    COALESCE(i.valor_calidad, 0)                AS valor_calidad,
    COALESCE(i.valor_bloqueado, 0)              AS valor_bloqueado,
    COALESCE(i.valor_libre,0) + COALESCE(i.valor_calidad,0)
    + COALESCE(i.valor_bloqueado,0)             AS valor_total,
    i.hora_snapshot
FROM fact.inventario i
LEFT JOIN dim.producto p ON i.codigo_mat = p.codigo_mat


-- ═══════════════════════════════════════════════════════
-- 5. ÓRDENES DE PRODUCCIÓN  (Página: Producción)
-- ═══════════════════════════════════════════════════════

SELECT
    o.planta,
    o.num_orden,
    o.centro,
    o.estatus,
    o.maquina,
    o.reproceso,
    o.codigo_mat,
    COALESCE(p.denominacion_material, o.codigo_mat) AS producto,
    COALESCE(p.categoria, 'N/D')                AS categoria,
    COALESCE(p.marca, 'N/D')                    AS marca,
    COALESCE(co.descripcion, o.cod_clase_orden) AS clase_orden,
    o.fecha_ini_extrema,
    o.fecha_fin_extrema,
    o.fecha_ini_real,
    o.fecha_fin_real,
    o.fecha_liberacion,
    o.cantidad_orden,
    o.cantidad_recibida,
    o.um_orden,
    CASE WHEN COALESCE(o.cantidad_orden,0) > 0
         THEN ROUND((COALESCE(o.cantidad_recibida,0) / o.cantidad_orden) * 100, 1)
         ELSE 0
    END                                         AS pct_cumplimiento,
    CASE WHEN o.fecha_ini_real IS NOT NULL AND o.fecha_fin_real IS NOT NULL
         THEN o.fecha_fin_real - o.fecha_ini_real
         ELSE NULL
    END                                         AS dias_proceso
FROM fact.ordenes o
LEFT JOIN dim.producto    p  ON o.codigo_mat      = p.codigo_mat
LEFT JOIN cat.clase_orden co ON o.cod_clase_orden = co.cod

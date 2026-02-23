import { useState } from "react";

interface PresetQuery {
  label: string;
  sql: string;
}

interface PresetCategory {
  name: string;
  queries: PresetQuery[];
}

const PRESETS: PresetCategory[] = [
  {
    name: "Conteos Generales",
    queries: [
      {
        label: "Total filas por tabla",
        sql: `SELECT 'dim_cliente' AS tabla, COUNT(*) AS filas FROM core.dim_cliente
UNION ALL SELECT 'dim_producto', COUNT(*) FROM core.dim_producto
UNION ALL SELECT 'dim_vendedor', COUNT(*) FROM core.dim_vendedor
UNION ALL SELECT 'dim_condicion_pago', COUNT(*) FROM core.dim_condicion_pago
UNION ALL SELECT 'dim_moneda', COUNT(*) FROM core.dim_moneda
UNION ALL SELECT 'fact_venta_linea', COUNT(*) FROM core.fact_venta_linea
ORDER BY filas DESC;`,
      },
      {
        label: "Conteo de catalogos",
        sql: `SELECT 'gpo_cliente' AS catalogo, COUNT(*) AS valores FROM core.dim_gpo_cliente
UNION ALL SELECT 'clase_doc', COUNT(*) FROM core.dim_clase_doc
UNION ALL SELECT 'sector', COUNT(*) FROM core.dim_sector
UNION ALL SELECT 'canal', COUNT(*) FROM core.dim_canal
UNION ALL SELECT 'zona_ventas', COUNT(*) FROM core.dim_zona_ventas
UNION ALL SELECT 'doc_comercial', COUNT(*) FROM core.dim_doc_comercial
UNION ALL SELECT 'grp_vend', COUNT(*) FROM core.dim_grp_vend
UNION ALL SELECT 'ramo', COUNT(*) FROM core.dim_ramo
UNION ALL SELECT 'gr_material', COUNT(*) FROM core.dim_gr_material
UNION ALL SELECT 'gr_articulo', COUNT(*) FROM core.dim_gr_articulo
UNION ALL SELECT 'lista_precio', COUNT(*) FROM core.dim_lista_precio
UNION ALL SELECT 'tx_motivo', COUNT(*) FROM core.dim_tx_motivo
ORDER BY valores DESC;`,
      },
      {
        label: "Calidad del ultimo lote",
        sql: `SELECT * FROM core.vw_calidad_lotes ORDER BY started_at DESC LIMIT 5;`,
      },
    ],
  },
  {
    name: "Por Fecha / Tiempo",
    queries: [
      {
        label: "Ventas por mes y anio",
        sql: `SELECT ejercicio, mes, COUNT(*) AS lineas,
  SUM(importe_final) AS total_importe,
  ROUND(AVG(importe_final)::numeric, 2) AS promedio
FROM core.fact_venta_linea
GROUP BY ejercicio, mes
ORDER BY ejercicio, mes;`,
      },
      {
        label: "Ventas por dia (ultimos 30 registros)",
        sql: `SELECT fecha_doc, COUNT(*) AS lineas,
  SUM(importe_final) AS total_importe
FROM core.fact_venta_linea
GROUP BY fecha_doc
ORDER BY fecha_doc DESC
LIMIT 30;`,
      },
      {
        label: "Distribucion por dia de semana",
        sql: `SELECT TO_CHAR(fecha_doc, 'Day') AS dia_semana,
  EXTRACT(DOW FROM fecha_doc) AS num_dia,
  COUNT(*) AS lineas,
  SUM(importe_final) AS total
FROM core.fact_venta_linea
GROUP BY dia_semana, num_dia
ORDER BY num_dia;`,
      },
      {
        label: "Rango de fechas en la data",
        sql: `SELECT MIN(fecha_doc) AS primera_fecha,
  MAX(fecha_doc) AS ultima_fecha,
  MAX(fecha_doc) - MIN(fecha_doc) AS dias_rango,
  COUNT(DISTINCT fecha_doc) AS dias_con_ventas
FROM core.fact_venta_linea;`,
      },
      {
        label: "Ventas por hora del dia",
        sql: `SELECT EXTRACT(HOUR FROM fechahora) AS hora,
  COUNT(*) AS lineas,
  SUM(importe_final) AS total
FROM core.fact_venta_linea
WHERE fechahora IS NOT NULL
GROUP BY hora
ORDER BY hora;`,
      },
    ],
  },
  {
    name: "Por Cliente",
    queries: [
      {
        label: "Top 20 clientes por monto",
        sql: `SELECT c.cod_cliente, c.nombre_cliente,
  COUNT(*) AS lineas,
  SUM(f.importe_final) AS total_importe,
  ROUND(AVG(f.importe_final)::numeric, 2) AS promedio
FROM core.fact_venta_linea f
JOIN core.dim_cliente c ON f.dim_cliente_id = c.dim_cliente_id
GROUP BY c.cod_cliente, c.nombre_cliente
ORDER BY total_importe DESC
LIMIT 20;`,
      },
      {
        label: "Clientes placeholder (huerfanos)",
        sql: `SELECT c.cod_cliente, c.nombre_cliente, c.is_placeholder,
  COUNT(f.fact_venta_linea_id) AS ventas
FROM core.dim_cliente c
LEFT JOIN core.fact_venta_linea f ON c.dim_cliente_id = f.dim_cliente_id
WHERE c.is_placeholder = true
GROUP BY c.cod_cliente, c.nombre_cliente, c.is_placeholder
ORDER BY ventas DESC;`,
      },
      {
        label: "Clientes sin ventas",
        sql: `SELECT c.cod_cliente, c.nombre_cliente, c.fecha_creacion_cliente
FROM core.dim_cliente c
LEFT JOIN core.fact_venta_linea f ON c.dim_cliente_id = f.dim_cliente_id
WHERE f.fact_venta_linea_id IS NULL AND c.is_placeholder = false
ORDER BY c.cod_cliente
LIMIT 50;`,
      },
      {
        label: "Clientes por estado",
        sql: `SELECT c.estado, COUNT(DISTINCT c.dim_cliente_id) AS clientes,
  COUNT(f.fact_venta_linea_id) AS lineas_venta,
  SUM(f.importe_final) AS total_importe
FROM core.dim_cliente c
LEFT JOIN core.fact_venta_linea f ON c.dim_cliente_id = f.dim_cliente_id
GROUP BY c.estado
ORDER BY total_importe DESC NULLS LAST;`,
      },
      {
        label: "Clientes con mas dias sin facturar",
        sql: `SELECT cod_cliente, nombre_cliente, dias_sin_facturar,
  fecha_ultima_factura, num_ultima_factura
FROM core.dim_cliente
WHERE dias_sin_facturar IS NOT NULL
ORDER BY dias_sin_facturar DESC
LIMIT 20;`,
      },
    ],
  },
  {
    name: "Por Producto / Marca",
    queries: [
      {
        label: "Top 20 productos por monto",
        sql: `SELECT p.codigo_mat, p.denominacion_material,
  p.jerarquia_1 AS marca,
  COUNT(*) AS lineas,
  SUM(f.importe_final) AS total_importe
FROM core.fact_venta_linea f
JOIN core.dim_producto p ON f.dim_producto_id = p.dim_producto_id
GROUP BY p.codigo_mat, p.denominacion_material, p.jerarquia_1
ORDER BY total_importe DESC
LIMIT 20;`,
      },
      {
        label: "Ventas por marca (jerarquia_1)",
        sql: `SELECT p.jerarquia_1 AS marca,
  COUNT(*) AS lineas,
  COUNT(DISTINCT p.codigo_mat) AS productos,
  SUM(f.importe_final) AS total_importe,
  ROUND(AVG(f.importe_final)::numeric, 2) AS promedio
FROM core.fact_venta_linea f
JOIN core.dim_producto p ON f.dim_producto_id = p.dim_producto_id
GROUP BY p.jerarquia_1
ORDER BY total_importe DESC;`,
      },
      {
        label: "Ventas por sector",
        sql: `SELECT s.valor_origen AS sector,
  COUNT(*) AS lineas,
  SUM(f.importe_final) AS total_importe
FROM core.fact_venta_linea f
JOIN core.dim_sector s ON f.dim_sector_id = s.dim_sector_id
GROUP BY s.valor_origen
ORDER BY total_importe DESC;`,
      },
      {
        label: "Productos por grupo material",
        sql: `SELECT gm.valor_origen AS gr_material,
  COUNT(DISTINCT p.codigo_mat) AS productos,
  COUNT(*) AS lineas_venta,
  SUM(f.importe_final) AS total
FROM core.fact_venta_linea f
JOIN core.dim_producto p ON f.dim_producto_id = p.dim_producto_id
JOIN core.dim_gr_material gm ON f.dim_gr_material_id = gm.dim_gr_material_id
GROUP BY gm.valor_origen
ORDER BY total DESC;`,
      },
    ],
  },
  {
    name: "Por Montos / Importes",
    queries: [
      {
        label: "Estadisticas de montos",
        sql: `SELECT
  COUNT(*) AS total_lineas,
  ROUND(SUM(importe_final)::numeric, 2) AS suma_total,
  ROUND(AVG(importe_final)::numeric, 2) AS promedio,
  ROUND(MIN(importe_final)::numeric, 2) AS minimo,
  ROUND(MAX(importe_final)::numeric, 2) AS maximo,
  ROUND(STDDEV(importe_final)::numeric, 2) AS desviacion,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY importe_final)::numeric, 2) AS mediana
FROM core.fact_venta_linea;`,
      },
      {
        label: "Distribucion por rangos de monto",
        sql: `SELECT
  CASE
    WHEN importe_final < 0 THEN 'Negativo (N/C)'
    WHEN importe_final = 0 THEN 'Cero'
    WHEN importe_final < 100 THEN '0-100'
    WHEN importe_final < 1000 THEN '100-1,000'
    WHEN importe_final < 10000 THEN '1,000-10,000'
    WHEN importe_final < 100000 THEN '10,000-100,000'
    ELSE '100,000+'
  END AS rango,
  COUNT(*) AS lineas,
  ROUND(SUM(importe_final)::numeric, 2) AS total
FROM core.fact_venta_linea
GROUP BY rango
ORDER BY MIN(importe_final);`,
      },
      {
        label: "Facturas con mayor importe",
        sql: `SELECT f.num_factura, f.fecha_doc,
  c.nombre_cliente, p.denominacion_material,
  f.importe_final, f.cantidad_umv, f.prec_unitario
FROM core.fact_venta_linea f
JOIN core.dim_cliente c ON f.dim_cliente_id = c.dim_cliente_id
JOIN core.dim_producto p ON f.dim_producto_id = p.dim_producto_id
ORDER BY f.importe_final DESC
LIMIT 20;`,
      },
      {
        label: "Notas de credito (importes negativos)",
        sql: `SELECT f.num_factura, f.fecha_doc,
  c.nombre_cliente, p.denominacion_material,
  cd.valor_origen AS clase_doc,
  f.importe_final, f.cantidad_umv
FROM core.fact_venta_linea f
JOIN core.dim_cliente c ON f.dim_cliente_id = c.dim_cliente_id
JOIN core.dim_producto p ON f.dim_producto_id = p.dim_producto_id
LEFT JOIN core.dim_clase_doc cd ON f.dim_clase_doc_id = cd.dim_clase_doc_id
WHERE f.importe_final < 0
ORDER BY f.importe_final ASC
LIMIT 30;`,
      },
      {
        label: "Comparativa moneda 1 vs moneda 2",
        sql: `SELECT m.cod_moneda, m.desc_moneda,
  COUNT(*) AS lineas,
  ROUND(SUM(f.importe_final)::numeric, 2) AS total_mon1,
  ROUND(SUM(f.importe_final_2)::numeric, 2) AS total_mon2,
  ROUND(AVG(f.tipo_cambio)::numeric, 4) AS tipo_cambio_prom
FROM core.fact_venta_linea f
JOIN core.dim_moneda m ON f.dim_moneda_id = m.dim_moneda_id
GROUP BY m.cod_moneda, m.desc_moneda;`,
      },
    ],
  },
  {
    name: "Por Canal / Zona / Vendedor",
    queries: [
      {
        label: "Ventas por canal",
        sql: `SELECT cn.valor_origen AS canal,
  COUNT(*) AS lineas,
  COUNT(DISTINCT c.cod_cliente) AS clientes,
  SUM(f.importe_final) AS total
FROM core.fact_venta_linea f
JOIN core.dim_canal cn ON f.dim_canal_id = cn.dim_canal_id
JOIN core.dim_cliente c ON f.dim_cliente_id = c.dim_cliente_id
GROUP BY cn.valor_origen
ORDER BY total DESC;`,
      },
      {
        label: "Ventas por zona",
        sql: `SELECT zv.valor_origen AS zona_ventas,
  COUNT(*) AS lineas,
  COUNT(DISTINCT c.cod_cliente) AS clientes,
  SUM(f.importe_final) AS total
FROM core.fact_venta_linea f
JOIN core.dim_zona_ventas zv ON f.dim_zona_ventas_id = zv.dim_zona_ventas_id
JOIN core.dim_cliente c ON f.dim_cliente_id = c.dim_cliente_id
GROUP BY zv.valor_origen
ORDER BY total DESC;`,
      },
      {
        label: "Top vendedores por monto",
        sql: `SELECT v.cod_vendedor, v.nombre_vendedor,
  COUNT(*) AS lineas,
  COUNT(DISTINCT c.cod_cliente) AS clientes,
  SUM(f.importe_final) AS total
FROM core.fact_venta_linea f
JOIN core.dim_vendedor v ON f.dim_vendedor_id = v.dim_vendedor_id
JOIN core.dim_cliente c ON f.dim_cliente_id = c.dim_cliente_id
GROUP BY v.cod_vendedor, v.nombre_vendedor
ORDER BY total DESC
LIMIT 15;`,
      },
      {
        label: "Ventas por grupo vendedor",
        sql: `SELECT gv.valor_origen AS grp_vend,
  COUNT(*) AS lineas,
  SUM(f.importe_final) AS total
FROM core.fact_venta_linea f
JOIN core.dim_grp_vend gv ON f.dim_grp_vend_id = gv.dim_grp_vend_id
GROUP BY gv.valor_origen
ORDER BY total DESC;`,
      },
      {
        label: "Ventas por condicion de pago",
        sql: `SELECT cp.cod_condicion_pago, cp.desc_condicion_pago,
  COUNT(*) AS lineas,
  SUM(f.importe_final) AS total
FROM core.fact_venta_linea f
JOIN core.dim_condicion_pago cp ON f.dim_condicion_pago_id = cp.dim_condicion_pago_id
GROUP BY cp.cod_condicion_pago, cp.desc_condicion_pago
ORDER BY total DESC;`,
      },
    ],
  },
  {
    name: "Por Ramo / Grupo Cliente",
    queries: [
      {
        label: "Ventas por ramo",
        sql: `SELECT ra.valor_origen AS ramo,
  COUNT(*) AS lineas,
  COUNT(DISTINCT c.cod_cliente) AS clientes,
  SUM(f.importe_final) AS total
FROM core.fact_venta_linea f
JOIN core.dim_ramo ra ON f.dim_ramo_id = ra.dim_ramo_id
JOIN core.dim_cliente c ON f.dim_cliente_id = c.dim_cliente_id
GROUP BY ra.valor_origen
ORDER BY total DESC;`,
      },
      {
        label: "Ventas por grupo cliente",
        sql: `SELECT gc.valor_origen AS gpo_cliente,
  COUNT(*) AS lineas,
  SUM(f.importe_final) AS total
FROM core.fact_venta_linea f
JOIN core.dim_gpo_cliente gc ON f.dim_gpo_cliente_id = gc.dim_gpo_cliente_id
GROUP BY gc.valor_origen
ORDER BY total DESC;`,
      },
      {
        label: "Clase de documento",
        sql: `SELECT cd.valor_origen AS clase_doc,
  COUNT(*) AS lineas,
  SUM(f.importe_final) AS total,
  SUM(CASE WHEN f.importe_final < 0 THEN 1 ELSE 0 END) AS negativos
FROM core.fact_venta_linea f
JOIN core.dim_clase_doc cd ON f.dim_clase_doc_id = cd.dim_clase_doc_id
GROUP BY cd.valor_origen
ORDER BY lineas DESC;`,
      },
    ],
  },
  {
    name: "Integridad / Calidad",
    queries: [
      {
        label: "FKs nulas en fact (dimensiones sin resolver)",
        sql: `SELECT
  COUNT(*) AS total,
  SUM(CASE WHEN dim_cliente_id IS NULL THEN 1 ELSE 0 END) AS sin_cliente,
  SUM(CASE WHEN dim_producto_id IS NULL THEN 1 ELSE 0 END) AS sin_producto,
  SUM(CASE WHEN dim_vendedor_id IS NULL THEN 1 ELSE 0 END) AS sin_vendedor,
  SUM(CASE WHEN dim_condicion_pago_id IS NULL THEN 1 ELSE 0 END) AS sin_cond_pago,
  SUM(CASE WHEN dim_moneda_id IS NULL THEN 1 ELSE 0 END) AS sin_moneda,
  SUM(CASE WHEN dim_canal_id IS NULL THEN 1 ELSE 0 END) AS sin_canal,
  SUM(CASE WHEN dim_zona_ventas_id IS NULL THEN 1 ELSE 0 END) AS sin_zona,
  SUM(CASE WHEN dim_sector_id IS NULL THEN 1 ELSE 0 END) AS sin_sector,
  SUM(CASE WHEN dim_ramo_id IS NULL THEN 1 ELSE 0 END) AS sin_ramo
FROM core.fact_venta_linea;`,
      },
      {
        label: "Valores UNKNOWN en catalogos",
        sql: `SELECT 'gpo_cliente' AS catalogo, COUNT(*) AS unknowns FROM core.dim_gpo_cliente WHERE valor_normalizado = 'UNKNOWN'
UNION ALL SELECT 'clase_doc', COUNT(*) FROM core.dim_clase_doc WHERE valor_normalizado = 'UNKNOWN'
UNION ALL SELECT 'sector', COUNT(*) FROM core.dim_sector WHERE valor_normalizado = 'UNKNOWN'
UNION ALL SELECT 'canal', COUNT(*) FROM core.dim_canal WHERE valor_normalizado = 'UNKNOWN'
UNION ALL SELECT 'zona_ventas', COUNT(*) FROM core.dim_zona_ventas WHERE valor_normalizado = 'UNKNOWN'
UNION ALL SELECT 'ramo', COUNT(*) FROM core.dim_ramo WHERE valor_normalizado = 'UNKNOWN'
UNION ALL SELECT 'tx_motivo', COUNT(*) FROM core.dim_tx_motivo WHERE valor_normalizado = 'UNKNOWN'
ORDER BY unknowns DESC;`,
      },
      {
        label: "Rechazos y warnings del ETL",
        sql: `SELECT 'rejects' AS tipo, COUNT(*) AS total FROM core.etl_rejects
UNION ALL SELECT 'warnings', COUNT(*) FROM core.etl_warnings;`,
      },
      {
        label: "Duplicados por line_hash",
        sql: `SELECT line_hash, COUNT(*) AS veces
FROM core.fact_venta_linea
GROUP BY line_hash
HAVING COUNT(*) > 1
ORDER BY veces DESC
LIMIT 20;`,
      },
      {
        label: "Metricas del ultimo batch",
        sql: `SELECT m.metric_name, m.metric_value
FROM core.etl_metrics m
JOIN core.etl_batch b ON m.batch_id = b.batch_id
ORDER BY b.started_at DESC, m.metric_name
LIMIT 20;`,
      },
    ],
  },
  {
    name: "Cruces Avanzados",
    queries: [
      {
        label: "Top 10 cliente-producto por monto",
        sql: `SELECT c.nombre_cliente, p.denominacion_material,
  COUNT(*) AS lineas,
  SUM(f.importe_final) AS total
FROM core.fact_venta_linea f
JOIN core.dim_cliente c ON f.dim_cliente_id = c.dim_cliente_id
JOIN core.dim_producto p ON f.dim_producto_id = p.dim_producto_id
GROUP BY c.nombre_cliente, p.denominacion_material
ORDER BY total DESC
LIMIT 10;`,
      },
      {
        label: "Marca por canal",
        sql: `SELECT p.jerarquia_1 AS marca, cn.valor_origen AS canal,
  COUNT(*) AS lineas,
  SUM(f.importe_final) AS total
FROM core.fact_venta_linea f
JOIN core.dim_producto p ON f.dim_producto_id = p.dim_producto_id
JOIN core.dim_canal cn ON f.dim_canal_id = cn.dim_canal_id
GROUP BY p.jerarquia_1, cn.valor_origen
ORDER BY total DESC
LIMIT 20;`,
      },
      {
        label: "Peso facturado por zona",
        sql: `SELECT zv.valor_origen AS zona,
  SUM(f.peso_fact) AS peso_total,
  COUNT(*) AS lineas,
  ROUND(AVG(f.peso_fact)::numeric, 2) AS peso_promedio
FROM core.fact_venta_linea f
JOIN core.dim_zona_ventas zv ON f.dim_zona_ventas_id = zv.dim_zona_ventas_id
WHERE f.peso_fact IS NOT NULL AND f.peso_fact > 0
GROUP BY zv.valor_origen
ORDER BY peso_total DESC;`,
      },
      {
        label: "Vista detalle completa (sample 20)",
        sql: `SELECT * FROM core.vw_ventas_detalle LIMIT 20;`,
      },
    ],
  },
  {
    name: "Drill-Down por Estado",
    queries: [
      {
        label: "Clientes de Miranda con ventas",
        sql: `-- Cambia 'Miranda' por el estado que quieras
SELECT c.cod_cliente, c.nombre_cliente, c.poblacion,
  c.cod_ruta_transporte, c.rif,
  COUNT(f.fact_venta_linea_id) AS lineas,
  SUM(f.importe_final) AS total_importe,
  MIN(f.fecha_doc) AS primera_venta,
  MAX(f.fecha_doc) AS ultima_venta
FROM core.dim_cliente c
LEFT JOIN core.fact_venta_linea f ON c.dim_cliente_id = f.dim_cliente_id
WHERE c.estado = 'Miranda'
GROUP BY c.cod_cliente, c.nombre_cliente, c.poblacion,
  c.cod_ruta_transporte, c.rif
ORDER BY total_importe DESC NULLS LAST
LIMIT 50;`,
      },
      {
        label: "Productos mas vendidos en Miranda",
        sql: `-- Cambia 'Miranda' por el estado que quieras
SELECT p.codigo_mat, p.denominacion_material,
  p.jerarquia_1 AS marca, p.sector,
  COUNT(*) AS lineas,
  SUM(f.cantidad_umv) AS cantidad_total,
  SUM(f.importe_final) AS total_importe
FROM core.fact_venta_linea f
JOIN core.dim_cliente c ON f.dim_cliente_id = c.dim_cliente_id
JOIN core.dim_producto p ON f.dim_producto_id = p.dim_producto_id
WHERE c.estado = 'Miranda'
GROUP BY p.codigo_mat, p.denominacion_material, p.jerarquia_1, p.sector
ORDER BY total_importe DESC
LIMIT 30;`,
      },
      {
        label: "Ventas por mes en un estado",
        sql: `-- Cambia 'Miranda' por el estado que quieras
SELECT f.ejercicio, f.mes,
  COUNT(*) AS lineas,
  COUNT(DISTINCT c.cod_cliente) AS clientes_activos,
  SUM(f.importe_final) AS total_importe
FROM core.fact_venta_linea f
JOIN core.dim_cliente c ON f.dim_cliente_id = c.dim_cliente_id
WHERE c.estado = 'Miranda'
GROUP BY f.ejercicio, f.mes
ORDER BY f.ejercicio, f.mes;`,
      },
      {
        label: "Vendedores en un estado",
        sql: `-- Cambia 'Miranda' por el estado que quieras
SELECT v.cod_vendedor, v.nombre_vendedor,
  COUNT(DISTINCT c.cod_cliente) AS clientes,
  COUNT(*) AS lineas,
  SUM(f.importe_final) AS total
FROM core.fact_venta_linea f
JOIN core.dim_cliente c ON f.dim_cliente_id = c.dim_cliente_id
JOIN core.dim_vendedor v ON f.dim_vendedor_id = v.dim_vendedor_id
WHERE c.estado = 'Miranda'
GROUP BY v.cod_vendedor, v.nombre_vendedor
ORDER BY total DESC;`,
      },
    ],
  },
  {
    name: "Drill-Down por Cliente",
    queries: [
      {
        label: "Detalle de un cliente especifico",
        sql: `-- Cambia el cod_cliente por el que quieras investigar
SELECT c.*
FROM core.dim_cliente c
WHERE c.cod_cliente = '10000021';`,
      },
      {
        label: "Facturas de un cliente",
        sql: `-- Cambia el cod_cliente
SELECT f.num_factura, f.fecha_doc, f.referencia,
  p.denominacion_material, p.jerarquia_1 AS marca,
  cd.valor_origen AS clase_doc,
  f.cantidad_umv, f.um_vtas,
  f.prec_unitario, f.monto_neto, f.iva, f.importe_final,
  cp.desc_condicion_pago
FROM core.fact_venta_linea f
JOIN core.dim_cliente c ON f.dim_cliente_id = c.dim_cliente_id
JOIN core.dim_producto p ON f.dim_producto_id = p.dim_producto_id
LEFT JOIN core.dim_clase_doc cd ON f.dim_clase_doc_id = cd.dim_clase_doc_id
LEFT JOIN core.dim_condicion_pago cp ON f.dim_condicion_pago_id = cp.dim_condicion_pago_id
WHERE c.cod_cliente = '10000021'
ORDER BY f.fecha_doc DESC
LIMIT 100;`,
      },
      {
        label: "Resumen mensual de un cliente",
        sql: `-- Cambia el cod_cliente
SELECT f.ejercicio, f.mes,
  COUNT(*) AS lineas,
  COUNT(DISTINCT p.codigo_mat) AS productos_distintos,
  SUM(f.importe_final) AS total,
  ROUND(AVG(f.importe_final)::numeric, 2) AS promedio_linea
FROM core.fact_venta_linea f
JOIN core.dim_cliente c ON f.dim_cliente_id = c.dim_cliente_id
JOIN core.dim_producto p ON f.dim_producto_id = p.dim_producto_id
WHERE c.cod_cliente = '10000021'
GROUP BY f.ejercicio, f.mes
ORDER BY f.ejercicio, f.mes;`,
      },
      {
        label: "Marcas que compra un cliente",
        sql: `-- Cambia el cod_cliente
SELECT p.jerarquia_1 AS marca,
  COUNT(*) AS lineas,
  COUNT(DISTINCT p.codigo_mat) AS productos,
  SUM(f.importe_final) AS total
FROM core.fact_venta_linea f
JOIN core.dim_cliente c ON f.dim_cliente_id = c.dim_cliente_id
JOIN core.dim_producto p ON f.dim_producto_id = p.dim_producto_id
WHERE c.cod_cliente = '10000021'
GROUP BY p.jerarquia_1
ORDER BY total DESC;`,
      },
      {
        label: "Buscar cliente por nombre (LIKE)",
        sql: `-- Cambia el patron de busqueda
SELECT c.cod_cliente, c.nombre_cliente, c.estado, c.poblacion,
  c.rif, c.is_placeholder
FROM core.dim_cliente c
WHERE UPPER(c.nombre_cliente) LIKE '%FARMACIA%'
ORDER BY c.nombre_cliente
LIMIT 30;`,
      },
    ],
  },
  {
    name: "Drill-Down por Producto",
    queries: [
      {
        label: "Detalle de un producto",
        sql: `-- Cambia el codigo_mat
SELECT p.*
FROM core.dim_producto p
WHERE p.codigo_mat = '000000000000110023';`,
      },
      {
        label: "Clientes que compran un producto",
        sql: `-- Cambia el codigo_mat
SELECT c.cod_cliente, c.nombre_cliente, c.estado,
  COUNT(*) AS veces_comprado,
  SUM(f.cantidad_umv) AS cantidad_total,
  SUM(f.importe_final) AS total_importe
FROM core.fact_venta_linea f
JOIN core.dim_cliente c ON f.dim_cliente_id = c.dim_cliente_id
JOIN core.dim_producto p ON f.dim_producto_id = p.dim_producto_id
WHERE p.codigo_mat = '000000000000110023'
GROUP BY c.cod_cliente, c.nombre_cliente, c.estado
ORDER BY total_importe DESC
LIMIT 30;`,
      },
      {
        label: "Evolucion mensual de un producto",
        sql: `-- Cambia el codigo_mat
SELECT f.ejercicio, f.mes,
  COUNT(*) AS lineas,
  SUM(f.cantidad_umv) AS cantidad,
  SUM(f.importe_final) AS total,
  ROUND(AVG(f.prec_unitario)::numeric, 2) AS precio_prom
FROM core.fact_venta_linea f
JOIN core.dim_producto p ON f.dim_producto_id = p.dim_producto_id
WHERE p.codigo_mat = '000000000000110023'
GROUP BY f.ejercicio, f.mes
ORDER BY f.ejercicio, f.mes;`,
      },
      {
        label: "Buscar producto por nombre (LIKE)",
        sql: `-- Cambia el patron de busqueda
SELECT p.codigo_mat, p.denominacion_material,
  p.jerarquia_1 AS marca, p.sector, p.gr_material
FROM core.dim_producto p
WHERE UPPER(p.denominacion_material) LIKE '%PAMPER%'
ORDER BY p.denominacion_material
LIMIT 30;`,
      },
    ],
  },
  {
    name: "Drill-Down por Fecha",
    queries: [
      {
        label: "Ventas de un dia especifico",
        sql: `-- Cambia la fecha (YYYY-MM-DD)
SELECT f.num_factura, f.fechahora,
  c.cod_cliente, c.nombre_cliente,
  p.denominacion_material,
  f.cantidad_umv, f.importe_final,
  cn.valor_origen AS canal
FROM core.fact_venta_linea f
JOIN core.dim_cliente c ON f.dim_cliente_id = c.dim_cliente_id
JOIN core.dim_producto p ON f.dim_producto_id = p.dim_producto_id
LEFT JOIN core.dim_canal cn ON f.dim_canal_id = cn.dim_canal_id
WHERE f.fecha_doc = '2025-03-15'
ORDER BY f.fechahora, f.num_factura
LIMIT 100;`,
      },
      {
        label: "Resumen de un mes especifico",
        sql: `-- Cambia ejercicio y mes
SELECT
  COUNT(*) AS lineas,
  COUNT(DISTINCT f.num_factura) AS facturas,
  COUNT(DISTINCT c.cod_cliente) AS clientes,
  COUNT(DISTINCT p.codigo_mat) AS productos,
  SUM(f.importe_final) AS total_importe,
  ROUND(AVG(f.importe_final)::numeric, 2) AS promedio,
  SUM(f.peso_fact) AS peso_total
FROM core.fact_venta_linea f
JOIN core.dim_cliente c ON f.dim_cliente_id = c.dim_cliente_id
JOIN core.dim_producto p ON f.dim_producto_id = p.dim_producto_id
WHERE f.ejercicio = 2025 AND f.mes = 3;`,
      },
      {
        label: "Ventas entre dos fechas",
        sql: `-- Cambia las fechas
SELECT f.fecha_doc,
  COUNT(*) AS lineas,
  COUNT(DISTINCT c.cod_cliente) AS clientes,
  SUM(f.importe_final) AS total
FROM core.fact_venta_linea f
JOIN core.dim_cliente c ON f.dim_cliente_id = c.dim_cliente_id
WHERE f.fecha_doc BETWEEN '2025-03-01' AND '2025-03-31'
GROUP BY f.fecha_doc
ORDER BY f.fecha_doc;`,
      },
      {
        label: "Facturas de una fecha por hora",
        sql: `-- Cambia la fecha
SELECT EXTRACT(HOUR FROM f.fechahora) AS hora,
  COUNT(*) AS lineas,
  COUNT(DISTINCT f.num_factura) AS facturas,
  SUM(f.importe_final) AS total
FROM core.fact_venta_linea f
WHERE f.fecha_doc = '2025-03-15'
  AND f.fechahora IS NOT NULL
GROUP BY hora
ORDER BY hora;`,
      },
    ],
  },
  {
    name: "Drill-Down por Canal/Zona",
    queries: [
      {
        label: "Clientes de un canal especifico",
        sql: `-- Cambia el canal (ejecuta 'Ventas por canal' para ver los valores)
SELECT c.cod_cliente, c.nombre_cliente, c.estado,
  COUNT(*) AS lineas,
  SUM(f.importe_final) AS total
FROM core.fact_venta_linea f
JOIN core.dim_cliente c ON f.dim_cliente_id = c.dim_cliente_id
JOIN core.dim_canal cn ON f.dim_canal_id = cn.dim_canal_id
WHERE cn.valor_origen = 'DETAL'
GROUP BY c.cod_cliente, c.nombre_cliente, c.estado
ORDER BY total DESC
LIMIT 30;`,
      },
      {
        label: "Productos por canal",
        sql: `-- Cambia el canal
SELECT p.denominacion_material, p.jerarquia_1 AS marca,
  COUNT(*) AS lineas,
  SUM(f.importe_final) AS total
FROM core.fact_venta_linea f
JOIN core.dim_producto p ON f.dim_producto_id = p.dim_producto_id
JOIN core.dim_canal cn ON f.dim_canal_id = cn.dim_canal_id
WHERE cn.valor_origen = 'DETAL'
GROUP BY p.denominacion_material, p.jerarquia_1
ORDER BY total DESC
LIMIT 20;`,
      },
      {
        label: "Detalle de una zona de ventas",
        sql: `-- Cambia la zona (ejecuta 'Ventas por zona' para ver los valores)
SELECT c.cod_cliente, c.nombre_cliente, c.estado,
  v.nombre_vendedor,
  COUNT(*) AS lineas,
  SUM(f.importe_final) AS total
FROM core.fact_venta_linea f
JOIN core.dim_cliente c ON f.dim_cliente_id = c.dim_cliente_id
JOIN core.dim_vendedor v ON f.dim_vendedor_id = v.dim_vendedor_id
JOIN core.dim_zona_ventas zv ON f.dim_zona_ventas_id = zv.dim_zona_ventas_id
WHERE zv.valor_origen = 'VZ01'
GROUP BY c.cod_cliente, c.nombre_cliente, c.estado, v.nombre_vendedor
ORDER BY total DESC
LIMIT 30;`,
      },
      {
        label: "Canal + Zona cruzado",
        sql: `SELECT cn.valor_origen AS canal, zv.valor_origen AS zona,
  COUNT(*) AS lineas,
  COUNT(DISTINCT c.cod_cliente) AS clientes,
  SUM(f.importe_final) AS total
FROM core.fact_venta_linea f
JOIN core.dim_canal cn ON f.dim_canal_id = cn.dim_canal_id
JOIN core.dim_zona_ventas zv ON f.dim_zona_ventas_id = zv.dim_zona_ventas_id
JOIN core.dim_cliente c ON f.dim_cliente_id = c.dim_cliente_id
GROUP BY cn.valor_origen, zv.valor_origen
ORDER BY total DESC;`,
      },
    ],
  },
  {
    name: "Drill-Down por Vendedor",
    queries: [
      {
        label: "Clientes de un vendedor",
        sql: `-- Cambia el cod_vendedor (ejecuta 'Top vendedores' para ver los codigos)
SELECT c.cod_cliente, c.nombre_cliente, c.estado,
  COUNT(*) AS lineas,
  SUM(f.importe_final) AS total
FROM core.fact_venta_linea f
JOIN core.dim_cliente c ON f.dim_cliente_id = c.dim_cliente_id
JOIN core.dim_vendedor v ON f.dim_vendedor_id = v.dim_vendedor_id
WHERE v.cod_vendedor = '00000250'
GROUP BY c.cod_cliente, c.nombre_cliente, c.estado
ORDER BY total DESC
LIMIT 30;`,
      },
      {
        label: "Productos de un vendedor",
        sql: `-- Cambia el cod_vendedor
SELECT p.denominacion_material, p.jerarquia_1 AS marca,
  COUNT(*) AS lineas,
  SUM(f.importe_final) AS total
FROM core.fact_venta_linea f
JOIN core.dim_producto p ON f.dim_producto_id = p.dim_producto_id
JOIN core.dim_vendedor v ON f.dim_vendedor_id = v.dim_vendedor_id
WHERE v.cod_vendedor = '00000250'
GROUP BY p.denominacion_material, p.jerarquia_1
ORDER BY total DESC
LIMIT 20;`,
      },
      {
        label: "Evolucion mensual de un vendedor",
        sql: `-- Cambia el cod_vendedor
SELECT f.ejercicio, f.mes,
  COUNT(*) AS lineas,
  COUNT(DISTINCT c.cod_cliente) AS clientes,
  SUM(f.importe_final) AS total
FROM core.fact_venta_linea f
JOIN core.dim_cliente c ON f.dim_cliente_id = c.dim_cliente_id
JOIN core.dim_vendedor v ON f.dim_vendedor_id = v.dim_vendedor_id
WHERE v.cod_vendedor = '00000250'
GROUP BY f.ejercicio, f.mes
ORDER BY f.ejercicio, f.mes;`,
      },
    ],
  },
  {
    name: "Drill-Down por Factura",
    queries: [
      {
        label: "Lineas de una factura",
        sql: `-- Cambia el num_factura
SELECT f.num_factura, f.fecha_doc, f.fechahora,
  c.nombre_cliente,
  p.codigo_mat, p.denominacion_material,
  f.cantidad_umv, f.um_vtas,
  f.prec_unitario, f.monto_neto, f.iva, f.importe_final,
  cd.valor_origen AS clase_doc,
  f.referencia, f.pedido_vta
FROM core.fact_venta_linea f
JOIN core.dim_cliente c ON f.dim_cliente_id = c.dim_cliente_id
JOIN core.dim_producto p ON f.dim_producto_id = p.dim_producto_id
LEFT JOIN core.dim_clase_doc cd ON f.dim_clase_doc_id = cd.dim_clase_doc_id
WHERE f.num_factura = '0192670688'
ORDER BY f._row_number;`,
      },
      {
        label: "Facturas por rango de numero",
        sql: `-- Cambia el rango
SELECT f.num_factura, f.fecha_doc,
  c.nombre_cliente,
  COUNT(*) AS lineas,
  SUM(f.importe_final) AS total
FROM core.fact_venta_linea f
JOIN core.dim_cliente c ON f.dim_cliente_id = c.dim_cliente_id
WHERE f.num_factura BETWEEN '0192670680' AND '0192670700'
GROUP BY f.num_factura, f.fecha_doc, c.nombre_cliente
ORDER BY f.num_factura;`,
      },
      {
        label: "Facturas anuladas",
        sql: `SELECT f.num_factura, f.fecha_doc,
  c.nombre_cliente,
  f.status_anulacion,
  cd.valor_origen AS clase_doc,
  SUM(f.importe_final) AS total
FROM core.fact_venta_linea f
JOIN core.dim_cliente c ON f.dim_cliente_id = c.dim_cliente_id
LEFT JOIN core.dim_clase_doc cd ON f.dim_clase_doc_id = cd.dim_clase_doc_id
WHERE f.status_anulacion IS NOT NULL AND f.status_anulacion != ''
GROUP BY f.num_factura, f.fecha_doc, c.nombre_cliente,
  f.status_anulacion, cd.valor_origen
ORDER BY f.fecha_doc DESC
LIMIT 30;`,
      },
    ],
  },
];

interface Props {
  onSelect: (sql: string) => void;
}

export function QueryPresets({ onSelect }: Props) {
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  const toggle = (name: string) => {
    setOpenCategory((prev) => (prev === name ? null : name));
  };

  return (
    <div className="query-presets">
      <h3>Consultas</h3>
      {PRESETS.map((cat) => (
        <div key={cat.name} className="preset-category">
          <button
            className={`preset-category-btn ${openCategory === cat.name ? "open" : ""}`}
            onClick={() => toggle(cat.name)}
          >
            <span className="arrow">{openCategory === cat.name ? "\u25BE" : "\u25B8"}</span>
            {cat.name}
            <span className="badge">{cat.queries.length}</span>
          </button>
          {openCategory === cat.name && (
            <ul>
              {cat.queries.map((q, i) => (
                <li key={i} onClick={() => onSelect(q.sql)}>
                  {q.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

import type { Sociedad } from '../../types/domain'
import type { PeriodoKey } from '../../stores/uiStore'
import { buildFilterClauses } from '../filters'

export interface VentasFilter {
  soc: Sociedad
  periodo: PeriodoKey
}

export function queryVentas(f: VentasFilter, limit = 5000): string {
  const { andClauses } = buildFilterClauses({
    soc: f.soc, centro: '', periodo: f.periodo,
    sociedadCol: 'sociedad', fechaCol: 'fecha_doc',
  })
  return `
    SELECT sociedad, cod_cliente, nombre_cliente, codigo_mat, producto,
           fecha_doc::text, cantidad_umv, monto_usd, cod_moneda
    FROM public.v_ventas
    WHERE 1=1${andClauses}
    ORDER BY fecha_doc DESC
    LIMIT ${limit}
  `
}

export function queryVentasPorMes(f: VentasFilter): string {
  const { andClauses } = buildFilterClauses({
    soc: f.soc, centro: '', periodo: f.periodo,
    sociedadCol: 'sociedad', fechaCol: 'fecha_doc',
  })
  return `
    SELECT to_char(date_trunc('month', fecha_doc), 'YYYY-MM') as mes,
           SUM(monto_usd) as total, COUNT(*) as num_facturas
    FROM public.v_ventas
    WHERE fecha_doc >= CURRENT_DATE - interval '12 months'${andClauses}
    GROUP BY 1 ORDER BY 1
  `
}

export function queryVentasPorCliente(f: VentasFilter): string {
  const { andClauses } = buildFilterClauses({
    soc: f.soc, centro: '', periodo: f.periodo,
    sociedadCol: 'sociedad', fechaCol: 'fecha_doc',
  })
  return `
    SELECT COALESCE(nombre_cliente, cod_cliente) as nombre,
           SUM(monto_usd) as total, COUNT(*) as num_facturas
    FROM public.v_ventas
    WHERE fecha_doc >= CURRENT_DATE - interval '3 months'${andClauses}
    GROUP BY nombre ORDER BY total DESC LIMIT 20
  `
}

export function queryVentasPorProducto(f: VentasFilter): string {
  const { andClauses } = buildFilterClauses({
    soc: f.soc, centro: '', periodo: f.periodo,
    sociedadCol: 'sociedad', fechaCol: 'fecha_doc',
  })
  return `
    SELECT codigo_mat, COALESCE(producto, codigo_mat) as nombre,
           SUM(monto_usd) as total, SUM(cantidad_umv) as cantidad_total
    FROM public.v_ventas
    WHERE fecha_doc >= CURRENT_DATE - interval '3 months'${andClauses}
    GROUP BY codigo_mat, nombre ORDER BY total DESC LIMIT 20
  `
}

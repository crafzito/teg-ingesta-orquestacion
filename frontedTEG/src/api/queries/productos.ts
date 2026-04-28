import type { Sociedad } from '../../types/domain'
import { buildFilterClauses } from '../filters'

export interface ProductosFilter {
  soc: Sociedad
  centro: string
}

export function queryProductos(f: ProductosFilter, limit = 5000): string {
  const { andClauses } = buildFilterClauses({
    soc: f.soc, centro: f.centro, periodo: 'todo',
    sociedadCol: 'i.sociedad', centroCol: 'i.centro',
  })
  return `
    SELECT
      i.codigo_mat,
      COALESCE(i.producto, i.codigo_mat) as producto,
      i.unidad,
      SUM(i.libre_ut) as libre_ut_total,
      SUM(i.valor_libre) as valor_libre_total
    FROM public.v_inventario i
    WHERE 1=1${andClauses}
    GROUP BY i.codigo_mat, i.producto, i.unidad
    ORDER BY valor_libre_total DESC
    LIMIT ${limit}
  `
}

export function queryProductoVentas(material: string, soc: Sociedad): string {
  const socFilter = soc ? ` AND sociedad = '${soc}'` : ''
  return `
    SELECT to_char(date_trunc('month', fecha_doc), 'YYYY-MM') as mes,
           SUM(monto_usd) as total, SUM(cantidad_umv) as cantidad
    FROM public.v_ventas
    WHERE codigo_mat = '${material}'${socFilter}
    AND fecha_doc >= CURRENT_DATE - interval '12 months'
    GROUP BY mes ORDER BY mes
  `
}

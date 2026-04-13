import type { Sociedad } from '../../types/domain'
import { withScopedPedidos } from './pedidosScope'

export function queryPedidos(soc: Sociedad, limit = 5000): string {
  return withScopedPedidos(
    `
      SELECT num_pedido, cod_cliente, nombre_cliente, codigo_mat, producto,
             ctd_ped, valor_neto, cod_moneda, status, fecha_doc::text
      FROM pedidos_scoped
      WHERE 1=1__SOC_FILTER__
      ORDER BY fecha_doc DESC
      LIMIT ${limit}
    `,
    soc,
  )
}

export function queryPedidosPorEstatus(soc: Sociedad): string {
  return withScopedPedidos(
    `
      SELECT status as nombre, COUNT(*) as total
      FROM pedidos_scoped
      WHERE 1=1__SOC_FILTER__
      GROUP BY status
      ORDER BY total DESC
    `,
    soc,
  )
}

export function queryPedidosPorMes(soc: Sociedad): string {
  return withScopedPedidos(
    `
      SELECT to_char(date_trunc('month', fecha_doc), 'YYYY-MM') as mes,
             COUNT(DISTINCT num_pedido) as total_pedidos,
             SUM(valor_neto) as valor_total
      FROM pedidos_scoped
      WHERE fecha_doc >= CURRENT_DATE - interval '12 months'__SOC_FILTER__
      GROUP BY 1
      ORDER BY 1
    `,
    soc,
  )
}

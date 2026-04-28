import type { Sociedad } from '../../types/domain'
import type { PeriodoKey } from '../../stores/uiStore'
import { withScopedPedidos } from './pedidosScope'
import { buildFilterClauses } from '../filters'

export interface PedidosFilter {
  soc: Sociedad
  periodo: PeriodoKey
}

function periodoOnly(periodo: PeriodoKey): string {
  const { andClauses } = buildFilterClauses({
    soc: '', centro: '', periodo,
    fechaCol: 'fecha_doc',
  })
  return andClauses
}

export function queryPedidos(f: PedidosFilter, limit = 5000): string {
  return withScopedPedidos(
    `
      SELECT num_pedido, cod_cliente, nombre_cliente, codigo_mat, producto,
             ctd_ped, valor_neto, cod_moneda, status, fecha_doc::text
      FROM pedidos_scoped
      WHERE 1=1__SOC_FILTER__${periodoOnly(f.periodo)}
      ORDER BY fecha_doc DESC
      LIMIT ${limit}
    `,
    f.soc,
  )
}

export function queryPedidosPorEstatus(f: PedidosFilter): string {
  return withScopedPedidos(
    `
      SELECT status as nombre, COUNT(*) as total
      FROM pedidos_scoped
      WHERE 1=1__SOC_FILTER__${periodoOnly(f.periodo)}
      GROUP BY status
      ORDER BY total DESC
    `,
    f.soc,
  )
}

export function queryPedidosPorMes(f: PedidosFilter): string {
  return withScopedPedidos(
    `
      SELECT to_char(date_trunc('month', fecha_doc), 'YYYY-MM') as mes,
             COUNT(DISTINCT num_pedido) as total_pedidos,
             SUM(valor_neto) as valor_total
      FROM pedidos_scoped
      WHERE fecha_doc >= CURRENT_DATE - interval '12 months'__SOC_FILTER__${periodoOnly(f.periodo)}
      GROUP BY 1
      ORDER BY 1
    `,
    f.soc,
  )
}

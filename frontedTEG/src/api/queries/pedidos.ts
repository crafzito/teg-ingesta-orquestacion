import type { Sociedad } from '../../types/domain'

export function queryPedidos(_soc: Sociedad, limit = 5000): string {
  return `
    SELECT num_pedido, cod_cliente, nombre_cliente, codigo_mat, producto,
           ctd_ped, valor_neto, cod_moneda, status, fecha_doc::text
    FROM public.v_pedidos
    WHERE 1=1
    ORDER BY fecha_doc DESC
    LIMIT ${limit}
  `
}

export function queryPedidosPorEstatus(_soc: Sociedad): string {
  return `
    SELECT status as nombre, COUNT(*) as total
    FROM public.v_pedidos
    WHERE 1=1
    GROUP BY status ORDER BY total DESC
  `
}

export function queryPedidosPorMes(_soc: Sociedad): string {
  return `
    SELECT to_char(date_trunc('month', fecha_doc), 'YYYY-MM') as mes,
           COUNT(DISTINCT num_pedido) as total_pedidos,
           SUM(valor_neto) as valor_total
    FROM public.v_pedidos
    WHERE fecha_doc >= CURRENT_DATE - interval '12 months'
    GROUP BY 1 ORDER BY 1
  `
}

import type { Sociedad } from '../../types/domain'

function socFilter(soc: Sociedad): string {
  return soc ? ` AND sociedad = '${soc}'` : ''
}

export function queryClientes(soc: Sociedad, limit = 5000): string {
  return `
    SELECT cod_cliente,
           COALESCE(nombre_cliente, cod_cliente) as nombre_cliente,
           sociedad,
           SUM(monto_usd) as total_ventas,
           COUNT(*) as num_facturas,
           MAX(fecha_doc)::text as ultima_compra
    FROM public.v_ventas
    WHERE 1=1${socFilter(soc)}
    GROUP BY cod_cliente, nombre_cliente, sociedad
    ORDER BY total_ventas DESC
    LIMIT ${limit}
  `
}

export function queryClienteDetalle(clienteId: string): string {
  return `
    SELECT sociedad, codigo_mat, producto, fecha_doc::text,
           cantidad_umv, monto_usd, cod_moneda
    FROM public.v_ventas
    WHERE cod_cliente = '${clienteId}'
    ORDER BY fecha_doc DESC
    LIMIT 100
  `
}

import type { Sociedad } from '../../types/domain'

function socFilter(soc: Sociedad): string {
  return soc ? ` AND sociedad = '${soc}'` : ''
}

export function queryVentas(soc: Sociedad, limit = 5000): string {
  return `
    SELECT sociedad, cod_cliente, nombre_cliente, codigo_mat, producto,
           fecha_doc::text, cantidad_umv, monto_usd, cod_moneda
    FROM public.v_ventas
    WHERE 1=1${socFilter(soc)}
    ORDER BY fecha_doc DESC
    LIMIT ${limit}
  `
}

export function queryVentasPorMes(soc: Sociedad): string {
  return `
    SELECT to_char(date_trunc('month', fecha_doc), 'YYYY-MM') as mes,
           SUM(monto_usd) as total, COUNT(*) as num_facturas
    FROM public.v_ventas
    WHERE fecha_doc >= CURRENT_DATE - interval '12 months'${socFilter(soc)}
    GROUP BY 1 ORDER BY 1
  `
}

export function queryVentasPorCliente(soc: Sociedad): string {
  return `
    SELECT COALESCE(nombre_cliente, cod_cliente) as nombre,
           SUM(monto_usd) as total, COUNT(*) as num_facturas
    FROM public.v_ventas
    WHERE fecha_doc >= CURRENT_DATE - interval '3 months'${socFilter(soc)}
    GROUP BY nombre ORDER BY total DESC LIMIT 20
  `
}

export function queryVentasPorProducto(soc: Sociedad): string {
  return `
    SELECT codigo_mat, COALESCE(producto, codigo_mat) as nombre,
           SUM(monto_usd) as total, SUM(cantidad_umv) as cantidad_total
    FROM public.v_ventas
    WHERE fecha_doc >= CURRENT_DATE - interval '3 months'${socFilter(soc)}
    GROUP BY codigo_mat, nombre ORDER BY total DESC LIMIT 20
  `
}

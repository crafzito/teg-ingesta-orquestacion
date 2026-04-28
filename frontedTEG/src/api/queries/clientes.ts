import type { Sociedad } from '../../types/domain'
import type { PeriodoKey } from '../../stores/uiStore'
import { buildFilterClauses } from '../filters'

export interface ClientesFilter {
  soc: Sociedad
  periodo: PeriodoKey
}

export function queryClientes(f: ClientesFilter, limit = 5000): string {
  const { andClauses } = buildFilterClauses({
    soc: f.soc, centro: '', periodo: f.periodo,
    sociedadCol: 'sociedad', fechaCol: 'fecha_doc',
  })
  return `
    SELECT cod_cliente,
           COALESCE(nombre_cliente, cod_cliente) as nombre_cliente,
           sociedad,
           SUM(monto_usd) as total_ventas,
           COUNT(*) as num_facturas,
           MAX(fecha_doc)::text as ultima_compra
    FROM public.v_ventas
    WHERE 1=1${andClauses}
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

import type { Sociedad } from '../../types/domain'
import { withScopedPedidos } from './pedidosScope'

function socFilter(soc: Sociedad, col = 'sociedad'): string {
  if (!soc) return ''
  return ` AND ${col} = '${soc}'`
}

function supportsSegmentation(view: string, col = 'sociedad'): string {
  return `EXISTS (SELECT 1 FROM ${view} WHERE NULLIF(BTRIM(COALESCE(${col}::text, '')), '') IS NOT NULL LIMIT 1)`
}

function resilientSocFilter(soc: Sociedad, view: string, col = 'sociedad'): string {
  if (!soc) return ''
  return ` AND (NOT ${supportsSegmentation(view, col)} OR ${col} = '${soc}')`
}

export function kpiVentasMes(soc: Sociedad): string {
  return `SELECT COALESCE(SUM(monto_usd), 0) as total FROM public.v_ventas WHERE date_trunc('month', fecha_doc) = date_trunc('month', CURRENT_DATE)${resilientSocFilter(soc, 'public.v_ventas')}`
}

export function kpiCxcTotal(soc: Sociedad): string {
  return `SELECT COALESCE(SUM(valor_monetario), 0) as total FROM public.v_cxc WHERE 1=1${resilientSocFilter(soc, 'public.v_cxc')}`
}

export function kpiCxcVencida(soc: Sociedad): string {
  return `SELECT COALESCE(SUM(total_vencido), 0) as total FROM public.v_cxc WHERE 1=1${resilientSocFilter(soc, 'public.v_cxc')}`
}

export function kpiInventarioValor(soc: Sociedad): string {
  return `SELECT COALESCE(SUM(valor_libre), 0) as total FROM public.v_inventario WHERE 1=1${resilientSocFilter(soc, 'public.v_inventario')}`
}

export function kpiOrdenesActivas(soc: Sociedad): string {
  return `SELECT COUNT(*) as total FROM public.v_ordenes WHERE estatus IN ('Abiertos', 'Liberados')${resilientSocFilter(soc, 'public.v_ordenes')}`
}

export function kpiPedidosMes(soc: Sociedad): string {
  return withScopedPedidos(
    'SELECT COUNT(DISTINCT num_pedido) as total FROM pedidos_scoped WHERE es_mes_actual = true__SOC_FILTER__',
    soc,
  )
}

export function chartVentasMensuales(soc: Sociedad): string {
  if (soc) {
    return `
      SELECT
        to_char(date_trunc('month', fecha_doc), 'YYYY-MM') as mes,
        COALESCE(SUM(monto_usd), 0) as total
      FROM public.v_ventas
      WHERE fecha_doc >= (CURRENT_DATE - interval '12 months')${resilientSocFilter(soc, 'public.v_ventas')}
      GROUP BY date_trunc('month', fecha_doc)
      ORDER BY mes
    `
  }

  return `
    SELECT
      to_char(date_trunc('month', fecha_doc), 'YYYY-MM') as mes,
      COALESCE(SUM(CASE WHEN sociedad = '1000' THEN monto_usd END), 0) as sociedad_1000,
      COALESCE(SUM(CASE WHEN sociedad = '1200' THEN monto_usd END), 0) as sociedad_1200,
      COALESCE(SUM(CASE WHEN sociedad = '1300' THEN monto_usd END), 0) as sociedad_1300
    FROM public.v_ventas
    WHERE fecha_doc >= (CURRENT_DATE - interval '12 months')${socFilter(soc)}
    GROUP BY date_trunc('month', fecha_doc)
    ORDER BY mes
  `
}

export function chartAgingCxc(soc: Sociedad): string {
  const filter = resilientSocFilter(soc, 'public.v_cxc')
  return `
    SELECT 'No vencido' as bucket, COALESCE(SUM(no_vencido), 0) as total FROM public.v_cxc WHERE 1=1${filter}
    UNION ALL
    SELECT '1-15 dias', COALESCE(SUM(venc_1_15), 0) FROM public.v_cxc WHERE 1=1${filter}
    UNION ALL
    SELECT '16-30 dias', COALESCE(SUM(venc_16_30), 0) FROM public.v_cxc WHERE 1=1${filter}
    UNION ALL
    SELECT '31-60 dias', COALESCE(SUM(venc_31_60), 0) FROM public.v_cxc WHERE 1=1${filter}
    UNION ALL
    SELECT '61-90 dias', COALESCE(SUM(venc_61_90), 0) FROM public.v_cxc WHERE 1=1${filter}
    UNION ALL
    SELECT '91+ dias', COALESCE(SUM(venc_91_mas), 0) FROM public.v_cxc WHERE 1=1${filter}
  `
}

export function chartTopClientes(soc: Sociedad): string {
  return `
    SELECT
      COALESCE(nombre_cliente, cod_cliente) as nombre,
      SUM(monto_usd) as total
    FROM public.v_ventas
    WHERE date_trunc('month', fecha_doc) >= date_trunc('month', CURRENT_DATE) - interval '3 months'${resilientSocFilter(soc, 'public.v_ventas')}
    GROUP BY nombre
    ORDER BY total DESC
    LIMIT 10
  `
}

export function chartVentasSociedad(soc: Sociedad): string {
  if (soc) {
    return `
      SELECT
        '${soc}' as sociedad,
        COALESCE(SUM(CASE WHEN date_trunc('month', fecha_doc) = date_trunc('month', CURRENT_DATE) THEN monto_usd END), 0) as mes_actual,
        COALESCE(SUM(CASE WHEN date_trunc('month', fecha_doc) = date_trunc('month', CURRENT_DATE) - interval '1 month' THEN monto_usd END), 0) as mes_anterior
      FROM public.v_ventas
      WHERE fecha_doc >= (CURRENT_DATE - interval '2 months')${resilientSocFilter(soc, 'public.v_ventas')}
    `
  }

  return `
    SELECT
      sociedad,
      COALESCE(SUM(CASE WHEN date_trunc('month', fecha_doc) = date_trunc('month', CURRENT_DATE) THEN monto_usd END), 0) as mes_actual,
      COALESCE(SUM(CASE WHEN date_trunc('month', fecha_doc) = date_trunc('month', CURRENT_DATE) - interval '1 month' THEN monto_usd END), 0) as mes_anterior
    FROM public.v_ventas
    WHERE fecha_doc >= (CURRENT_DATE - interval '2 months')${socFilter(soc)}
    GROUP BY sociedad
    ORDER BY sociedad
  `
}

export function chartPedidosStatus(soc: Sociedad): string {
  return withScopedPedidos(
    `
      SELECT
        status as nombre,
        COUNT(*) as total
      FROM pedidos_scoped
      WHERE 1=1__SOC_FILTER__
      GROUP BY status
      ORDER BY total DESC
    `,
    soc,
  )
}

export function chartOrdenesCentro(soc: Sociedad): string {
  return `
    SELECT
      centro,
      SUM(CASE WHEN estatus = 'Abiertos' THEN 1 ELSE 0 END) as abiertas,
      SUM(CASE WHEN estatus = 'Liberados' THEN 1 ELSE 0 END) as liberadas,
      SUM(CASE WHEN estatus = 'Cerrado técnicamente' THEN 1 ELSE 0 END) as cerradas
    FROM public.v_ordenes
    WHERE 1=1${resilientSocFilter(soc, 'public.v_ordenes')}
    GROUP BY centro
    ORDER BY centro
  `
}

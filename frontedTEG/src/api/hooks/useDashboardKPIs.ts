import { useQueries } from '@tanstack/react-query'
import { apiClient } from '../client'
import { STALE_TIME } from '../../config/env'
import { useUiStore } from '../../stores/uiStore'
import {
  kpiVentasMes, kpiCxcTotal, kpiCxcVencida,
  kpiInventarioValor, kpiOrdenesActivas, kpiPedidosMes,
  chartVentasMensuales, chartAgingCxc, chartTopClientes,
  chartVentasSociedad, chartPedidosStatus, chartOrdenesCentro,
} from '../queries/dashboard'

async function fetchScalar(sql: string): Promise<number> {
  const res = await apiClient.query(sql, 1)
  return res.rows.length > 0 ? Number(res.rows[0][0]) || 0 : 0
}

async function fetchRows<T extends Record<string, unknown>>(sql: string): Promise<T[]> {
  const res = await apiClient.query(sql, 1000)
  return res.rows.map((row) => {
    const obj: Record<string, unknown> = {}
    res.columns.forEach((col, i) => { obj[col] = row[i] })
    return obj as T
  })
}

export function useDashboardKPIs() {
  const soc = useUiStore((s) => s.selectedSociedad)

  const results = useQueries({
    queries: [
      { queryKey: ['kpi', 'ventas-mes', soc], queryFn: () => fetchScalar(kpiVentasMes(soc)), staleTime: STALE_TIME, refetchOnMount: 'always' as const },
      { queryKey: ['kpi', 'cxc-total', soc], queryFn: () => fetchScalar(kpiCxcTotal(soc)), staleTime: STALE_TIME, refetchOnMount: 'always' as const },
      { queryKey: ['kpi', 'cxc-vencida', soc], queryFn: () => fetchScalar(kpiCxcVencida(soc)), staleTime: STALE_TIME, refetchOnMount: 'always' as const },
      { queryKey: ['kpi', 'inventario-valor', soc], queryFn: () => fetchScalar(kpiInventarioValor(soc)), staleTime: STALE_TIME, refetchOnMount: 'always' as const },
      { queryKey: ['kpi', 'ordenes-activas', soc], queryFn: () => fetchScalar(kpiOrdenesActivas(soc)), staleTime: STALE_TIME, refetchOnMount: 'always' as const },
      { queryKey: ['kpi', 'pedidos-mes', soc], queryFn: () => fetchScalar(kpiPedidosMes(soc)), staleTime: STALE_TIME, refetchOnMount: 'always' as const },
    ],
  })

  const isLoading = results.some((r) => r.isLoading)
  const isError = results.some((r) => r.isError)

  return {
    ventasMes: results[0].data ?? 0,
    cxcTotal: results[1].data ?? 0,
    cxcVencida: results[2].data ?? 0,
    inventarioValor: results[3].data ?? 0,
    ordenesActivas: results[4].data ?? 0,
    pedidosMes: results[5].data ?? 0,
    isLoading,
    isError,
  }
}

export function useDashboardCharts() {
  const soc = useUiStore((s) => s.selectedSociedad)

  const ventasMensuales = useQueries({
    queries: [
      {
        queryKey: ['chart', 'ventas-mensuales', soc],
        queryFn: () => fetchRows<{ mes: string; sociedad_1000?: number; sociedad_1200?: number; sociedad_1300?: number; total?: number }>(chartVentasMensuales(soc)),
        staleTime: STALE_TIME,
        refetchOnMount: 'always' as const,
      },
      {
        queryKey: ['chart', 'aging-cxc', soc],
        queryFn: () => fetchRows<{ bucket: string; total: number }>(chartAgingCxc(soc)),
        staleTime: STALE_TIME,
        refetchOnMount: 'always' as const,
      },
      {
        queryKey: ['chart', 'top-clientes', soc],
        queryFn: () => fetchRows<{ nombre: string; total: number }>(chartTopClientes(soc)),
        staleTime: STALE_TIME,
        refetchOnMount: 'always' as const,
      },
      {
        queryKey: ['chart', 'ventas-sociedad', soc],
        queryFn: () => fetchRows<{ sociedad: string; mes_actual: number; mes_anterior: number }>(chartVentasSociedad(soc)),
        staleTime: STALE_TIME,
        refetchOnMount: 'always' as const,
      },
      {
        queryKey: ['chart', 'pedidos-status', soc],
        queryFn: () => fetchRows<{ nombre: string; total: number }>(chartPedidosStatus(soc)),
        staleTime: STALE_TIME,
        refetchOnMount: 'always' as const,
      },
      {
        queryKey: ['chart', 'ordenes-centro', soc],
        queryFn: () => fetchRows<{ centro: string; abiertas: number; liberadas: number; cerradas: number }>(chartOrdenesCentro(soc)),
        staleTime: STALE_TIME,
        refetchOnMount: 'always' as const,
      },
    ],
  })

  return {
    ventasMensuales: ventasMensuales[0].data ?? [],
    agingCxc: (ventasMensuales[1].data ?? []).map((r) => ({ name: r.bucket, value: Number(r.total) })),
    topClientes: (ventasMensuales[2].data ?? []).map((r) => ({ name: r.nombre, value: Number(r.total) })),
    ventasSociedad: ventasMensuales[3].data ?? [],
    pedidosStatus: (ventasMensuales[4].data ?? []).map((r) => ({ name: r.nombre, value: Number(r.total) })),
    ordenesCentro: ventasMensuales[5].data ?? [],
    isLoading: ventasMensuales.some((r) => r.isLoading),
  }
}

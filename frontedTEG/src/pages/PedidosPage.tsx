import { useMemo } from 'react'
import { ShoppingCart, DollarSign, Tag, ListChecks } from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { PageHeader } from '../components/ui/PageHeader'
import { FilterBar } from '../components/dashboard/FilterBar'
import { KPICard } from '../components/dashboard/KPICard'
import { ChartCard } from '../components/dashboard/ChartCard'
import { ChartTooltip } from '../components/dashboard/ChartTooltip'
import { CHART_COLORS } from '../components/dashboard/palette'
import { DataTable } from '../components/ui/DataTable'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { usePedidosTable, usePedidosPorEstatus, usePedidosPorMes } from '../api/hooks/usePedidos'
import { formatCurrency, formatDate, formatNumber } from '../lib/formatters'

const columns = [
  { key: 'num_pedido' as const, label: 'Pedido' },
  { key: 'nombre_cliente' as const, label: 'Cliente' },
  { key: 'codigo_mat' as const, label: 'Material' },
  { key: 'producto' as const, label: 'Producto' },
  { key: 'ctd_ped' as const, label: 'Cantidad', align: 'end' as const, render: (v: unknown) => formatNumber(Number(v)) },
  { key: 'valor_neto' as const, label: 'Valor Neto', align: 'end' as const, render: (v: unknown) => formatCurrency(Number(v)) },
  { key: 'status' as const, label: 'Estatus' },
  { key: 'fecha_doc' as const, label: 'Fecha', render: (v: unknown) => formatDate(String(v)) },
]

export default function PedidosPage() {
  const { data: rows, isLoading } = usePedidosTable()
  const { data: porEstatus } = usePedidosPorEstatus()
  const { data: porMes } = usePedidosPorMes()

  const kpis = useMemo(() => {
    const monthly = porMes ?? []
    const last = monthly[monthly.length - 1]
    const prev = monthly[monthly.length - 2]
    const totalPedidos = Number(last?.total_pedidos ?? 0)
    const valorTotal = Number(last?.valor_total ?? 0)
    const ticket = totalPedidos > 0 ? valorTotal / totalPedidos : 0
    const estatusCount = (porEstatus ?? []).length
    const trend = prev && Number(prev.total_pedidos) > 0
      ? ((totalPedidos - Number(prev.total_pedidos)) / Number(prev.total_pedidos)) * 100
      : undefined
    const sparkline = monthly.slice(-12).map((m) => Number(m.total_pedidos ?? 0))
    return { totalPedidos, valorTotal, ticket, estatusCount, trend, sparkline }
  }, [porMes, porEstatus])

  return (
    <div>
      <PageHeader title="Pedidos" description="Seguimiento de pedidos de venta" />
      <FilterBar />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <KPICard title="Pedidos del Mes" value={formatNumber(kpis.totalPedidos)} icon={<ShoppingCart className="h-5 w-5" />} accent="pink" trend={kpis.trend} sparkline={kpis.sparkline} index={0} />
        <KPICard title="Valor del Mes" value={formatCurrency(kpis.valorTotal)} icon={<DollarSign className="h-5 w-5" />} accent="success" index={1} />
        <KPICard title="Ticket Promedio" value={formatCurrency(kpis.ticket)} icon={<Tag className="h-5 w-5" />} accent="primary" index={2} />
        <KPICard title="Estatus Activos" value={formatNumber(kpis.estatusCount)} icon={<ListChecks className="h-5 w-5" />} accent="violet" index={3} />
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
            <ChartCard title="Pedidos Mensuales" subtitle="Evolucion del volumen" index={0} height="md" className="lg:col-span-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={(porMes ?? []).map((r) => ({ mes: r.mes, Pedidos: Number(r.total_pedidos) }))} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="ped-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS[5]} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={CHART_COLORS[5]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                  <Tooltip content={<ChartTooltip valueFormatter={(v) => formatNumber(v)} />} />
                  <Area type="monotone" dataKey="Pedidos" stroke={CHART_COLORS[5]} fill="url(#ped-grad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Pedidos por Estatus" subtitle="Distribucion" index={1} height="md">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={(porEstatus ?? []).map((r) => ({ name: r.nombre, value: Number(r.total) }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={78}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {(porEstatus ?? []).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip valueFormatter={(v) => formatNumber(v)} />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
          <DataTable title="Detalle de Pedidos" data={rows ?? []} columns={columns} isLoading={isLoading} />
        </>
      )}
    </div>
  )
}

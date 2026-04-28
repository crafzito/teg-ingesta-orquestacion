import { PageHeader } from '../components/ui/PageHeader'
import { FilterBar } from '../components/dashboard/FilterBar'
import { KPICard } from '../components/dashboard/KPICard'
import { ChartCard } from '../components/dashboard/ChartCard'
import { ChartTooltip } from '../components/dashboard/ChartTooltip'
import { CHART_COLORS } from '../components/dashboard/palette'
import { DataTable } from '../components/ui/DataTable'
import { useMemo } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { motion } from 'framer-motion'
import { BarListCard } from '../components/charts/BarListCard'
import { GaugeChartCard } from '../components/charts/GaugeChartCard'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { DollarSign, Receipt, Users, ShoppingBag } from 'lucide-react'
import { useVentasTable, useVentasPorMes, useVentasPorCliente, useVentasPorProducto } from '../api/hooks/useVentas'
import { formatCurrency, formatDate, formatNumber, formatPercent } from '../lib/formatters'

const columns = [
  { key: 'sociedad' as const, label: 'Sociedad' },
  { key: 'nombre_cliente' as const, label: 'Cliente' },
  { key: 'codigo_mat' as const, label: 'Material' },
  { key: 'producto' as const, label: 'Producto' },
  { key: 'fecha_doc' as const, label: 'Fecha', render: (v: unknown) => formatDate(String(v)) },
  { key: 'cantidad_umv' as const, label: 'Cantidad', align: 'end' as const, render: (v: unknown) => formatNumber(Number(v)) },
  { key: 'monto_usd' as const, label: 'Monto USD', align: 'end' as const, render: (v: unknown) => formatCurrency(Number(v)) },
]

export default function VentasPage() {
  const { data: rows, isLoading } = useVentasTable()
  const { data: porMes } = useVentasPorMes()
  const { data: porCliente } = useVentasPorCliente()
  const { data: porProducto } = useVentasPorProducto()

  const monthly = useMemo(() => (porMes ?? []).map((r) => ({
    mes: r.mes,
    total: Number(r.total ?? 0),
    numFacturas: Number(r.num_facturas ?? 0),
  })), [porMes])

  const current = monthly[monthly.length - 1]
  const previous = monthly[monthly.length - 2]
  const currentTotal = current?.total ?? 0
  const previousTotal = previous?.total ?? 0
  const ratio = previousTotal > 0 ? (currentTotal / previousTotal) * 100 : currentTotal > 0 ? 100 : 0
  const ticketPromedio = current && current.numFacturas > 0 ? currentTotal / current.numFacturas : 0
  const numFacturas = current?.numFacturas ?? 0
  const clientesActivos = (porCliente ?? []).length
  const sparkline = monthly.slice(-12).map((m) => m.total)
  const trendDelta = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : undefined

  return (
    <div>
      <PageHeader title="Ventas" description="Analisis de ventas por periodo, cliente y producto" />
      <FilterBar />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <KPICard title="Ventas del Mes" value={formatCurrency(currentTotal)} icon={<DollarSign className="h-5 w-5" />} accent="success" sparkline={sparkline} trend={trendDelta} index={0} />
        <KPICard title="Ticket Promedio" value={formatCurrency(ticketPromedio)} icon={<Receipt className="h-5 w-5" />} accent="primary" index={1} />
        <KPICard title="Facturas" value={formatNumber(numFacturas)} icon={<ShoppingBag className="h-5 w-5" />} accent="violet" index={2} />
        <KPICard title="Clientes Activos" value={formatNumber(clientesActivos)} icon={<Users className="h-5 w-5" />} accent="accent" index={3} />
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
            <ChartCard title="Ventas Mensuales" subtitle="Evolucion total" index={0} height="md" className="lg:col-span-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthly.map((m) => ({ mes: m.mes, Total: m.total }))} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="ventas-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS[2]} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={CHART_COLORS[2]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#a1a1aa" tickFormatter={(v) => formatCurrency(v)} />
                  <Tooltip content={<ChartTooltip valueFormatter={(v) => formatCurrency(v)} />} />
                  <Area type="monotone" dataKey="Total" stroke={CHART_COLORS[2]} fill="url(#ventas-grad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
              <GaugeChartCard
                title="Ritmo de venta"
                helperText="Mes actual vs mes anterior"
                value={ratio}
                valueLabel={formatPercent(ratio)}
                subtitle="del mes anterior"
                leftLabel="Mes actual"
                leftValue={formatCurrency(currentTotal)}
                rightLabel="Ticket promedio"
                rightValue={formatCurrency(ticketPromedio)}
              />
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="lg:col-span-2">
              <BarListCard
                title="Top Clientes (3 meses)"
                data={(porCliente ?? []).map((r) => ({ name: r.nombre, value: Number(r.total) }))}
                valueFormatter={(v) => formatCurrency(v)}
              />
            </motion.div>

            <ChartCard title="Top Productos" subtitle="Mix por venta" index={3} height="md">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={(porProducto ?? []).slice(0, 6).map((r) => ({ name: r.nombre, value: Number(r.total) }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={72}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {(porProducto ?? []).slice(0, 6).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip valueFormatter={(v) => formatCurrency(v)} />} />
                  <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
          <DataTable title="Detalle de Ventas" data={rows ?? []} columns={columns} isLoading={isLoading} />
        </>
      )}
    </div>
  )
}

import { useMemo } from 'react'
import { Factory, CheckCircle2, ListChecks, MapPin } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from 'recharts'
import { PageHeader } from '../components/ui/PageHeader'
import { FilterBar } from '../components/dashboard/FilterBar'
import { KPICard } from '../components/dashboard/KPICard'
import { ChartCard } from '../components/dashboard/ChartCard'
import { ChartTooltip } from '../components/dashboard/ChartTooltip'
import { CHART_COLORS } from '../components/dashboard/palette'
import { DataTable } from '../components/ui/DataTable'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { useOrdenesTable, useOrdenesPorEstatus, useOrdenesPorCentro } from '../api/hooks/useOrdenes'
import { formatNumber, formatDate } from '../lib/formatters'

const columns = [
  { key: 'centro' as const, label: 'Centro' },
  { key: 'num_orden' as const, label: 'Orden' },
  { key: 'codigo_mat' as const, label: 'Material' },
  { key: 'producto' as const, label: 'Producto' },
  { key: 'cantidad_orden' as const, label: 'Cant. Orden', align: 'end' as const, render: (v: unknown) => formatNumber(Number(v)) },
  { key: 'cantidad_recibida' as const, label: 'Cant. Recibida', align: 'end' as const, render: (v: unknown) => formatNumber(Number(v)) },
  { key: 'estatus' as const, label: 'Estatus' },
  { key: 'fecha_ini_extrema' as const, label: 'Inicio', render: (v: unknown) => formatDate(String(v)) },
  { key: 'fecha_fin_extrema' as const, label: 'Fin', render: (v: unknown) => formatDate(String(v)) },
]

export default function ProduccionPage() {
  const { data: rows, isLoading } = useOrdenesTable()
  const { data: porEstatus } = useOrdenesPorEstatus()
  const { data: porCentro } = useOrdenesPorCentro()

  const kpis = useMemo(() => {
    const all = porCentro ?? []
    const abiertas = all.reduce((s, r) => s + Number(r.abiertas ?? 0), 0)
    const liberadas = all.reduce((s, r) => s + Number(r.liberadas ?? 0), 0)
    const cerradas = all.reduce((s, r) => s + Number(r.cerradas ?? 0), 0)
    const activas = abiertas + liberadas
    const total = activas + cerradas
    return { activas, cerradas, total, centros: all.length }
  }, [porCentro])

  return (
    <div>
      <PageHeader title="Ordenes de Produccion" description="Seguimiento de ordenes por centro y estatus" />
      <FilterBar showCentro />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 items-stretch">
        <KPICard title="Ordenes Activas" value={formatNumber(kpis.activas)} icon={<Factory className="h-5 w-5" />} accent="violet" index={0} />
        <KPICard title="Ordenes Cerradas" value={formatNumber(kpis.cerradas)} icon={<CheckCircle2 className="h-5 w-5" />} accent="success" index={1} />
        <KPICard title="Total" value={formatNumber(kpis.total)} icon={<ListChecks className="h-5 w-5" />} accent="primary" index={2} />
        <KPICard title="Centros" value={formatNumber(kpis.centros)} icon={<MapPin className="h-5 w-5" />} accent="warning" index={3} />
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
            <ChartCard title="Ordenes por Estatus" subtitle="Distribucion actual" index={0} height="md">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={(porEstatus ?? []).map((r) => ({ name: r.estatus, value: Number(r.total) }))}
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

            <ChartCard title="Ordenes por Centro" subtitle="Apilado por estatus" index={1} height="md" className="lg:col-span-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={(porCentro ?? []).map((r) => ({
                    centro: String(r.centro),
                    Abiertas: Number(r.abiertas),
                    Liberadas: Number(r.liberadas),
                    Cerradas: Number(r.cerradas),
                  }))}
                  margin={{ top: 5, right: 16, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="centro" tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                  <Tooltip content={<ChartTooltip valueFormatter={(v) => formatNumber(v)} />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Abiertas" stackId="o" fill={CHART_COLORS[0]} />
                  <Bar dataKey="Liberadas" stackId="o" fill={CHART_COLORS[3]} />
                  <Bar dataKey="Cerradas" stackId="o" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
          <DataTable title="Detalle de Ordenes" data={rows ?? []} columns={columns} isLoading={isLoading} />
        </>
      )}
    </div>
  )
}

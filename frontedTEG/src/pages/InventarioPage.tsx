import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Package, Boxes, MapPin, BarChart3 } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { PageHeader } from '../components/ui/PageHeader'
import { FilterBar } from '../components/dashboard/FilterBar'
import { KPICard } from '../components/dashboard/KPICard'
import { ChartCard } from '../components/dashboard/ChartCard'
import { ChartTooltip } from '../components/dashboard/ChartTooltip'
import { CHART_COLORS } from '../components/dashboard/palette'
import { DataTable } from '../components/ui/DataTable'
import { BarListCard } from '../components/charts/BarListCard'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { useInventarioTable, useInventarioPorCentro, useInventarioTopMateriales } from '../api/hooks/useInventario'
import { formatCurrency, formatNumber, formatPercent } from '../lib/formatters'

const columns = [
  { key: 'centro' as const, label: 'Centro' },
  { key: 'almacen' as const, label: 'Almacen' },
  { key: 'codigo_mat' as const, label: 'Material' },
  { key: 'producto' as const, label: 'Producto' },
  { key: 'tipo_inv' as const, label: 'Tipo Inv.' },
  { key: 'libre_ut' as const, label: 'Stock', align: 'end' as const, render: (v: unknown) => formatNumber(Number(v)) },
  { key: 'valor_libre' as const, label: 'Valor', align: 'end' as const, render: (v: unknown) => formatCurrency(Number(v)) },
  { key: 'unidad' as const, label: 'Unidad' },
]

export default function InventarioPage() {
  const { data: rows, isLoading } = useInventarioTable()
  const { data: porCentro } = useInventarioPorCentro()
  const { data: topMateriales } = useInventarioTopMateriales()

  const kpis = useMemo(() => {
    const all = porCentro ?? []
    const valor = all.reduce((s, r) => s + Number(r.valor ?? 0), 0)
    const materiales = all.reduce((s, r) => s + Number(r.materiales ?? 0), 0)
    const centros = all.length
    const tableRows = rows ?? []
    const conStock = tableRows.filter((r) => Number(r.libre_ut ?? 0) > 0).length
    const pctConStock = tableRows.length > 0 ? (conStock / tableRows.length) * 100 : 0
    return { valor, materiales, centros, pctConStock }
  }, [porCentro, rows])

  return (
    <div>
      <PageHeader title="Inventario" description="Stock y valorizacion por centro y material" />
      <FilterBar showCentro />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 items-stretch">
        <KPICard title="Valor Total" value={formatCurrency(kpis.valor)} icon={<Package className="h-5 w-5" />} accent="warning" index={0} />
        <KPICard title="Materiales" value={formatNumber(kpis.materiales)} icon={<Boxes className="h-5 w-5" />} accent="primary" index={1} />
        <KPICard title="Centros" value={formatNumber(kpis.centros)} icon={<MapPin className="h-5 w-5" />} accent="violet" index={2} />
        <KPICard title="% SKUs con Stock" value={formatPercent(kpis.pctConStock)} icon={<BarChart3 className="h-5 w-5" />} accent="success" index={3} />
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
            <ChartCard title="Inventario por Centro" subtitle="Valor en USD" index={0} height="md" className="lg:col-span-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(porCentro ?? []).map((r) => ({ centro: String(r.centro), Valor: Number(r.valor) }))} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="centro" tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#a1a1aa" tickFormatter={(v) => formatCurrency(v)} />
                  <Tooltip content={<ChartTooltip valueFormatter={(v) => formatCurrency(v)} />} />
                  <Bar dataKey="Valor" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Distribucion por Centro" subtitle="Mix porcentual" index={1} height="md">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={(porCentro ?? []).map((r) => ({ name: String(r.centro), value: Number(r.valor) }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={78}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {(porCentro ?? []).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip valueFormatter={(v) => formatCurrency(v)} />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="lg:col-span-3">
              <BarListCard
                title="Top Materiales por Valor"
                data={(topMateriales ?? []).map((r) => ({ name: r.nombre, value: Number(r.valor) }))}
                valueFormatter={(v) => formatCurrency(v)}
              />
            </motion.div>
          </div>
          <DataTable title="Detalle de Inventario" data={rows ?? []} columns={columns} isLoading={isLoading} />
        </>
      )}
    </div>
  )
}

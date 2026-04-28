import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Wallet, AlertTriangle, Percent, FileText } from 'lucide-react'
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
import { useCxpTable, useCxpAging, useCxpPorProveedor } from '../api/hooks/useCxp'
import { formatCurrency, formatDate, formatNumber, formatPercent } from '../lib/formatters'

const columns = [
  { key: 'sociedad' as const, label: 'Sociedad' },
  { key: 'nombre_proveedor' as const, label: 'Proveedor' },
  { key: 'n_documento' as const, label: 'Documento' },
  { key: 'fecha_doc' as const, label: 'Fecha Doc', render: (v: unknown) => formatDate(String(v)) },
  { key: 'fecha_venc' as const, label: 'Vencimiento', render: (v: unknown) => formatDate(String(v)) },
  { key: 'importe' as const, label: 'Importe', align: 'end' as const, render: (v: unknown) => formatCurrency(Number(v)) },
  { key: 'd_venc' as const, label: 'Dias Vencido', align: 'end' as const, render: (v: unknown) => formatNumber(Number(v)) },
]

export default function CxpPage() {
  const { data: rows, isLoading } = useCxpTable()
  const { data: aging } = useCxpAging()
  const { data: porProveedor } = useCxpPorProveedor()

  const totals = useMemo(() => {
    const all = aging ?? []
    const total = all.reduce((s, r) => s + Number(r.total ?? 0), 0)
    const vencida = all.filter((r) => /venc|>|\+/i.test(r.bucket)).reduce((s, r) => s + Number(r.total ?? 0), 0)
    const docs = all.reduce((s, r) => s + Number(r.count ?? 0), 0)
    return { total, vencida, docs }
  }, [aging])

  const ratio = totals.total > 0 ? (totals.vencida / totals.total) * 100 : 0

  return (
    <div>
      <PageHeader title="Cuentas por Pagar" description="Analisis de pagos y antiguedad" />
      <FilterBar />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <KPICard title="CxP Total" value={formatCurrency(totals.total)} icon={<Wallet className="h-5 w-5" />} accent="primary" index={0} />
        <KPICard title="CxP Vencida" value={formatCurrency(totals.vencida)} icon={<AlertTriangle className="h-5 w-5" />} accent="accent" index={1} />
        <KPICard title="% Vencido" value={formatPercent(ratio)} icon={<Percent className="h-5 w-5" />} accent="warning" index={2} />
        <KPICard title="Documentos" value={formatNumber(totals.docs)} icon={<FileText className="h-5 w-5" />} accent="violet" index={3} />
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
            <ChartCard title="Antiguedad CxP" subtitle="Distribucion del saldo" index={0} height="md">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={(aging ?? []).map((r) => ({ name: r.bucket, value: Number(r.total) }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={78}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {(aging ?? []).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip valueFormatter={(v) => formatCurrency(v)} />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }} className="lg:col-span-2">
              <BarListCard
                title="Top Proveedores por Saldo"
                data={(porProveedor ?? []).map((r) => ({ name: r.nombre, value: Number(r.total) }))}
                valueFormatter={(v) => formatCurrency(v)}
              />
            </motion.div>

            <ChartCard title="Antiguedad por Monto" subtitle="Saldo en cada rango" index={2} height="md" className="lg:col-span-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(aging ?? []).map((r) => ({ bucket: r.bucket, Monto: Number(r.total) }))} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#a1a1aa" tickFormatter={(v) => formatCurrency(v)} />
                  <Tooltip content={<ChartTooltip valueFormatter={(v) => formatCurrency(v)} />} />
                  <Bar dataKey="Monto" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
          <DataTable title="Detalle CxP" data={rows ?? []} columns={columns} isLoading={isLoading} />
        </>
      )}
    </div>
  )
}

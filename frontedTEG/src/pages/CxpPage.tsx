import { PageHeader } from '../components/ui/PageHeader'
import { FilterBar } from '../components/ui/FilterBar'
import { DataTable } from '../components/ui/DataTable'
import { DonutChartCard } from '../components/charts/DonutChartCard'
import { BarListCard } from '../components/charts/BarListCard'
import { BarChartCard } from '../components/charts/BarChartCard'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { useCxpTable, useCxpAging, useCxpPorProveedor } from '../api/hooks/useCxp'
import { formatCurrency, formatDate, formatNumber } from '../lib/formatters'

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

  return (
    <div>
      <PageHeader title="Cuentas por Pagar" description="Analisis de pagos y antigüedad" />
      <FilterBar />
      {isLoading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <DonutChartCard title="Aging CxP" data={(aging ?? []).map((r) => ({ name: r.bucket, value: Number(r.total) }))} valueFormatter={(v) => formatCurrency(v)} />
            <BarListCard title="Top Proveedores por Saldo" data={(porProveedor ?? []).map((r) => ({ name: r.nombre, value: Number(r.total) }))} valueFormatter={(v) => formatCurrency(v)} />
            <BarChartCard title="Aging por Monto" data={(aging ?? []).map((r) => ({ bucket: r.bucket, Monto: Number(r.total) }))} index="bucket" categories={['Monto']} valueFormatter={(v) => formatCurrency(v)} />
          </div>
          <DataTable title="Detalle CxP" data={rows ?? []} columns={columns} isLoading={isLoading} />
        </>
      )}
    </div>
  )
}

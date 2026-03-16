import { PageHeader } from '../components/ui/PageHeader'
import { FilterBar } from '../components/ui/FilterBar'
import { DataTable } from '../components/ui/DataTable'
import { DonutChartCard } from '../components/charts/DonutChartCard'
import { BarListCard } from '../components/charts/BarListCard'
import { BarChartCard } from '../components/charts/BarChartCard'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { useCxcTable, useCxcAging, useCxcPorCliente } from '../api/hooks/useCxc'
import { formatCurrency, formatDate, formatNumber } from '../lib/formatters'

const columns = [
  { key: 'sociedad' as const, label: 'Sociedad' },
  { key: 'nombre_cliente' as const, label: 'Cliente' },
  { key: 'n_documento' as const, label: 'Documento' },
  { key: 'fecha_doc' as const, label: 'Fecha Doc', render: (v: unknown) => formatDate(String(v)) },
  { key: 'fecha_venc' as const, label: 'Vencimiento', render: (v: unknown) => formatDate(String(v)) },
  { key: 'valor_monetario' as const, label: 'Valor', align: 'end' as const, render: (v: unknown) => formatCurrency(Number(v)) },
  { key: 'd_venc' as const, label: 'Dias Vencido', align: 'end' as const, render: (v: unknown) => formatNumber(Number(v)) },
  { key: 'total_vencido' as const, label: 'Total Vencido', align: 'end' as const, render: (v: unknown) => formatCurrency(Number(v)) },
]

export default function CxcPage() {
  const { data: rows, isLoading } = useCxcTable()
  const { data: aging } = useCxcAging()
  const { data: porCliente } = useCxcPorCliente()

  return (
    <div>
      <PageHeader title="Cuentas por Cobrar" description="Analisis de cartera y antigüedad" />
      <FilterBar />
      {isLoading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <DonutChartCard title="Aging CxC" data={(aging ?? []).map((r) => ({ name: r.bucket, value: Number(r.total) }))} valueFormatter={(v) => formatCurrency(v)} />
            <BarListCard title="Top Clientes por Saldo" data={(porCliente ?? []).map((r) => ({ name: r.nombre, value: Number(r.total) }))} valueFormatter={(v) => formatCurrency(v)} />
            <BarChartCard title="Aging por Monto" data={(aging ?? []).map((r) => ({ bucket: r.bucket, Monto: Number(r.total) }))} index="bucket" categories={['Monto']} valueFormatter={(v) => formatCurrency(v)} />
          </div>
          <DataTable title="Detalle CxC" data={rows ?? []} columns={columns} isLoading={isLoading} />
        </>
      )}
    </div>
  )
}

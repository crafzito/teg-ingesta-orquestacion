import { PageHeader } from '../components/ui/PageHeader'
import { FilterBar } from '../components/ui/FilterBar'
import { DataTable } from '../components/ui/DataTable'
import { DonutChartCard } from '../components/charts/DonutChartCard'
import { BarChartCard } from '../components/charts/BarChartCard'
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

  return (
    <div>
      <PageHeader title="Ordenes de Produccion" description="Seguimiento de ordenes por centro y estatus" />
      <FilterBar />
      {isLoading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <DonutChartCard title="Ordenes por Estatus" data={(porEstatus ?? []).map((r) => ({ name: r.estatus, value: Number(r.total) }))} />
            <BarChartCard title="Ordenes por Centro" data={(porCentro ?? []).map((r) => ({ centro: String(r.centro), Abiertas: Number(r.abiertas), Liberadas: Number(r.liberadas), Cerradas: Number(r.cerradas) }))} index="centro" categories={['Abiertas', 'Liberadas', 'Cerradas']} stacked />
          </div>
          <DataTable title="Detalle de Ordenes" data={rows ?? []} columns={columns} isLoading={isLoading} />
        </>
      )}
    </div>
  )
}

import { PageHeader } from '../components/ui/PageHeader'
import { FilterBar } from '../components/ui/FilterBar'
import { DataTable } from '../components/ui/DataTable'
import { BarChartCard } from '../components/charts/BarChartCard'
import { BarListCard } from '../components/charts/BarListCard'
import { DonutChartCard } from '../components/charts/DonutChartCard'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { useInventarioTable, useInventarioPorCentro, useInventarioTopMateriales } from '../api/hooks/useInventario'
import { formatCurrency, formatNumber } from '../lib/formatters'

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

  return (
    <div>
      <PageHeader title="Inventario" description="Stock y valorizacion por centro y material" />
      <FilterBar />
      {isLoading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <BarChartCard title="Inventario por Centro" data={(porCentro ?? []).map((r) => ({ centro: String(r.centro), Valor: Number(r.valor) }))} index="centro" categories={['Valor']} valueFormatter={(v) => formatCurrency(v)} />
            <BarListCard title="Top Materiales por Valor" data={(topMateriales ?? []).map((r) => ({ name: r.nombre, value: Number(r.valor) }))} valueFormatter={(v) => formatCurrency(v)} />
            <DonutChartCard title="Distribucion por Centro" data={(porCentro ?? []).map((r) => ({ name: String(r.centro), value: Number(r.valor) }))} valueFormatter={(v) => formatCurrency(v)} />
          </div>
          <DataTable title="Detalle de Inventario" data={rows ?? []} columns={columns} isLoading={isLoading} />
        </>
      )}
    </div>
  )
}

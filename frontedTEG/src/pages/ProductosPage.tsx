import { PageHeader } from '../components/ui/PageHeader'
import { FilterBar } from '../components/ui/FilterBar'
import { DataTable } from '../components/ui/DataTable'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { useProductosTable } from '../api/hooks/useProductos'
import { formatCurrency, formatNumber } from '../lib/formatters'

const columns = [
  { key: 'codigo_mat' as const, label: 'Material' },
  { key: 'producto' as const, label: 'Producto' },
  { key: 'unidad' as const, label: 'Unidad' },
  { key: 'libre_ut_total' as const, label: 'Stock Total', align: 'end' as const, render: (v: unknown) => formatNumber(Number(v)) },
  { key: 'valor_libre_total' as const, label: 'Valor Total', align: 'end' as const, render: (v: unknown) => formatCurrency(Number(v)) },
]

export default function ProductosPage() {
  const { data: rows, isLoading } = useProductosTable()
  return (
    <div>
      <PageHeader title="Productos" description="Catalogo de materiales con stock y valorizacion" />
      <FilterBar />
      {isLoading ? <LoadingSpinner /> : <DataTable title="Productos" data={rows ?? []} columns={columns} isLoading={isLoading} />}
    </div>
  )
}

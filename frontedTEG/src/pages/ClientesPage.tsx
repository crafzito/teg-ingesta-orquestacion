import { PageHeader } from '../components/ui/PageHeader'
import { FilterBar } from '../components/ui/FilterBar'
import { DataTable } from '../components/ui/DataTable'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { useClientesTable } from '../api/hooks/useClientes'
import { formatCurrency, formatDate, formatNumber, sociedadLabel } from '../lib/formatters'

const columns = [
  { key: 'cod_cliente' as const, label: 'Codigo' },
  { key: 'nombre_cliente' as const, label: 'Nombre' },
  { key: 'sociedad' as const, label: 'Sociedad', render: (v: unknown) => sociedadLabel(String(v)) },
  { key: 'total_ventas' as const, label: 'Total Ventas', align: 'end' as const, render: (v: unknown) => formatCurrency(Number(v)) },
  { key: 'num_facturas' as const, label: 'Facturas', align: 'end' as const, render: (v: unknown) => formatNumber(Number(v)) },
  { key: 'ultima_compra' as const, label: 'Ultima Compra', render: (v: unknown) => formatDate(String(v)) },
]

export default function ClientesPage() {
  const { data: rows, isLoading } = useClientesTable()
  return (
    <div>
      <PageHeader title="Clientes" description="Directorio de clientes y metricas de venta" />
      <FilterBar />
      {isLoading ? <LoadingSpinner /> : <DataTable title="Clientes" data={rows ?? []} columns={columns} isLoading={isLoading} />}
    </div>
  )
}

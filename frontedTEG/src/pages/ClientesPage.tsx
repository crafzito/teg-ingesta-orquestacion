import { useMemo } from 'react'
import { Users, DollarSign, Receipt, BadgeCheck } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { FilterBar } from '../components/dashboard/FilterBar'
import { KPICard } from '../components/dashboard/KPICard'
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

  const kpis = useMemo(() => {
    const all = rows ?? []
    const total = all.length
    const ventas = all.reduce((s, r) => s + Number(r.total_ventas ?? 0), 0)
    const facturas = all.reduce((s, r) => s + Number(r.num_facturas ?? 0), 0)
    const ticket = facturas > 0 ? ventas / facturas : 0
    return { total, ventas, facturas, ticket }
  }, [rows])

  return (
    <div>
      <PageHeader title="Clientes" description="Directorio de clientes y metricas de venta" />
      <FilterBar showRange={false} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 items-stretch">
        <KPICard title="Clientes" value={formatNumber(kpis.total)} icon={<Users className="h-5 w-5" />} accent="primary" index={0} />
        <KPICard title="Ventas Totales" value={formatCurrency(kpis.ventas)} icon={<DollarSign className="h-5 w-5" />} accent="success" index={1} />
        <KPICard title="Facturas" value={formatNumber(kpis.facturas)} icon={<Receipt className="h-5 w-5" />} accent="violet" index={2} />
        <KPICard title="Ticket Promedio" value={formatCurrency(kpis.ticket)} icon={<BadgeCheck className="h-5 w-5" />} accent="warning" index={3} />
      </div>

      {isLoading ? <LoadingSpinner /> : <DataTable title="Clientes" data={rows ?? []} columns={columns} isLoading={isLoading} />}
    </div>
  )
}

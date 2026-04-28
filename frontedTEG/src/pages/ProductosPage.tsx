import { useMemo } from 'react'
import { Boxes, Package, Layers, BarChart3 } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { FilterBar } from '../components/dashboard/FilterBar'
import { KPICard } from '../components/dashboard/KPICard'
import { DataTable } from '../components/ui/DataTable'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { useProductosTable } from '../api/hooks/useProductos'
import { formatCurrency, formatNumber, formatPercent } from '../lib/formatters'

const columns = [
  { key: 'codigo_mat' as const, label: 'Material' },
  { key: 'producto' as const, label: 'Producto' },
  { key: 'unidad' as const, label: 'Unidad' },
  { key: 'libre_ut_total' as const, label: 'Stock Total', align: 'end' as const, render: (v: unknown) => formatNumber(Number(v)) },
  { key: 'valor_libre_total' as const, label: 'Valor Total', align: 'end' as const, render: (v: unknown) => formatCurrency(Number(v)) },
]

export default function ProductosPage() {
  const { data: rows, isLoading } = useProductosTable()

  const kpis = useMemo(() => {
    const all = rows ?? []
    const total = all.length
    const valor = all.reduce((s, r) => s + Number(r.valor_libre_total ?? 0), 0)
    const stock = all.reduce((s, r) => s + Number(r.libre_ut_total ?? 0), 0)
    const conStock = all.filter((r) => Number(r.libre_ut_total ?? 0) > 0).length
    const pct = total > 0 ? (conStock / total) * 100 : 0
    return { total, valor, stock, pct }
  }, [rows])

  return (
    <div>
      <PageHeader title="Productos" description="Catalogo de materiales con stock y valorizacion" />
      <FilterBar showRange={false} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 items-stretch">
        <KPICard title="Productos" value={formatNumber(kpis.total)} icon={<Boxes className="h-5 w-5" />} accent="primary" index={0} />
        <KPICard title="Valor Total" value={formatCurrency(kpis.valor)} icon={<Package className="h-5 w-5" />} accent="warning" index={1} />
        <KPICard title="Stock Total" value={formatNumber(kpis.stock)} icon={<Layers className="h-5 w-5" />} accent="violet" index={2} />
        <KPICard title="% con Stock" value={formatPercent(kpis.pct)} icon={<BarChart3 className="h-5 w-5" />} accent="success" index={3} />
      </div>

      {isLoading ? <LoadingSpinner /> : <DataTable title="Productos" data={rows ?? []} columns={columns} isLoading={isLoading} />}
    </div>
  )
}

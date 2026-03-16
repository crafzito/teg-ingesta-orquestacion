import { PageHeader } from '../components/ui/PageHeader'
import { FilterBar } from '../components/ui/FilterBar'
import { DataTable } from '../components/ui/DataTable'
import { AreaChartCard } from '../components/charts/AreaChartCard'
import { BarListCard } from '../components/charts/BarListCard'
import { DonutChartCard } from '../components/charts/DonutChartCard'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { useVentasTable, useVentasPorMes, useVentasPorCliente, useVentasPorProducto } from '../api/hooks/useVentas'
import { formatCurrency, formatDate, formatNumber } from '../lib/formatters'

const columns = [
  { key: 'sociedad' as const, label: 'Sociedad' },
  { key: 'nombre_cliente' as const, label: 'Cliente' },
  { key: 'codigo_mat' as const, label: 'Material' },
  { key: 'producto' as const, label: 'Producto' },
  { key: 'fecha_doc' as const, label: 'Fecha', render: (v: unknown) => formatDate(String(v)) },
  { key: 'cantidad_umv' as const, label: 'Cantidad', align: 'end' as const, render: (v: unknown) => formatNumber(Number(v)) },
  { key: 'monto_usd' as const, label: 'Monto USD', align: 'end' as const, render: (v: unknown) => formatCurrency(Number(v)) },
]

export default function VentasPage() {
  const { data: rows, isLoading } = useVentasTable()
  const { data: porMes } = useVentasPorMes()
  const { data: porCliente } = useVentasPorCliente()
  const { data: porProducto } = useVentasPorProducto()

  return (
    <div>
      <PageHeader title="Ventas" description="Analisis de ventas por periodo, cliente y producto" />
      <FilterBar />
      {isLoading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <AreaChartCard
              title="Ventas Mensuales"
              data={(porMes ?? []).map((r) => ({ mes: r.mes, Total: Number(r.total) }))}
              index="mes" categories={['Total']} valueFormatter={(v) => formatCurrency(v)}
            />
            <BarListCard
              title="Top Clientes (3 meses)"
              data={(porCliente ?? []).map((r) => ({ name: r.nombre, value: Number(r.total) }))}
              valueFormatter={(v) => formatCurrency(v)}
            />
            <DonutChartCard
              title="Top Productos por Venta"
              data={(porProducto ?? []).slice(0, 8).map((r) => ({ name: r.nombre, value: Number(r.total) }))}
              valueFormatter={(v) => formatCurrency(v)}
            />
          </div>
          <DataTable title="Detalle de Ventas" data={rows ?? []} columns={columns} isLoading={isLoading} />
        </>
      )}
    </div>
  )
}

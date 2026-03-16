import { PageHeader } from '../components/ui/PageHeader'
import { FilterBar } from '../components/ui/FilterBar'
import { DataTable } from '../components/ui/DataTable'
import { DonutChartCard } from '../components/charts/DonutChartCard'
import { AreaChartCard } from '../components/charts/AreaChartCard'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { usePedidosTable, usePedidosPorEstatus, usePedidosPorMes } from '../api/hooks/usePedidos'
import { formatCurrency, formatDate, formatNumber } from '../lib/formatters'

const columns = [
  { key: 'num_pedido' as const, label: 'Pedido' },
  { key: 'nombre_cliente' as const, label: 'Cliente' },
  { key: 'codigo_mat' as const, label: 'Material' },
  { key: 'producto' as const, label: 'Producto' },
  { key: 'ctd_ped' as const, label: 'Cantidad', align: 'end' as const, render: (v: unknown) => formatNumber(Number(v)) },
  { key: 'valor_neto' as const, label: 'Valor Neto', align: 'end' as const, render: (v: unknown) => formatCurrency(Number(v)) },
  { key: 'status' as const, label: 'Estatus' },
  { key: 'fecha_doc' as const, label: 'Fecha', render: (v: unknown) => formatDate(String(v)) },
]

export default function PedidosPage() {
  const { data: rows, isLoading } = usePedidosTable()
  const { data: porEstatus } = usePedidosPorEstatus()
  const { data: porMes } = usePedidosPorMes()

  return (
    <div>
      <PageHeader title="Pedidos" description="Seguimiento de pedidos de venta" />
      <FilterBar />
      {isLoading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <DonutChartCard title="Pedidos por Estatus" data={(porEstatus ?? []).map((r) => ({ name: r.nombre, value: Number(r.total) }))} />
            <AreaChartCard title="Pedidos Mensuales" data={(porMes ?? []).map((r) => ({ mes: r.mes, Pedidos: Number(r.total_pedidos) }))} index="mes" categories={['Pedidos']} />
          </div>
          <DataTable title="Detalle de Pedidos" data={rows ?? []} columns={columns} isLoading={isLoading} />
        </>
      )}
    </div>
  )
}

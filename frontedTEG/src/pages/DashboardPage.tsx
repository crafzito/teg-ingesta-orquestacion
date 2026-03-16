import {
  DollarSign, CreditCard, AlertTriangle, Package, Factory, ShoppingCart,
} from 'lucide-react'
import { Tabs, Tab } from '@heroui/react'
import { PageHeader } from '../components/ui/PageHeader'
import { FilterBar } from '../components/ui/FilterBar'
import { KpiCard } from '../components/ui/KpiCard'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { AreaChartCard } from '../components/charts/AreaChartCard'
import { DonutChartCard } from '../components/charts/DonutChartCard'
import { BarListCard } from '../components/charts/BarListCard'
import { BarChartCard } from '../components/charts/BarChartCard'
import { LineChartCard } from '../components/charts/LineChartCard'
import { ComposedChartCard } from '../components/charts/ComposedChartCard'
import { useDashboardKPIs, useDashboardCharts } from '../api/hooks/useDashboardKPIs'
import { formatCurrency, formatNumber, sociedadLabel } from '../lib/formatters'

export default function DashboardPage() {
  const kpis = useDashboardKPIs()
  const charts = useDashboardCharts()

  return (
    <div>
      <PageHeader title="Dashboard" description="Vista general del negocio" />
      <FilterBar />

      {kpis.isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <KpiCard title="Ventas del Mes" value={formatCurrency(kpis.ventasMes)} icon={<DollarSign className="h-6 w-6" />} />
            <KpiCard title="CxC Total" value={formatCurrency(kpis.cxcTotal)} icon={<CreditCard className="h-6 w-6" />} />
            <KpiCard title="CxC Vencida" value={formatCurrency(kpis.cxcVencida)} icon={<AlertTriangle className="h-6 w-6" />} />
            <KpiCard title="Inventario Valorizado" value={formatCurrency(kpis.inventarioValor)} icon={<Package className="h-6 w-6" />} />
            <KpiCard title="Ordenes Activas" value={formatNumber(kpis.ordenesActivas)} icon={<Factory className="h-6 w-6" />} />
            <KpiCard title="Pedidos del Mes" value={formatNumber(kpis.pedidosMes)} icon={<ShoppingCart className="h-6 w-6" />} />
          </div>

          {charts.isLoading ? (
            <LoadingSpinner />
          ) : (
            <Tabs aria-label="Dashboard sections" color="primary" variant="underlined" classNames={{ tabList: 'mb-6' }}>
              <Tab key="ventas" title="Ventas">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <AreaChartCard
                    title="Ventas Mensuales (12 meses)"
                    data={charts.ventasMensuales.map((r) => ({
                      mes: r.mes,
                      Pharsana: Number(r.sociedad_1000),
                      Ampofrasca: Number(r.sociedad_1200),
                      'Proy. PET': Number(r.sociedad_1300),
                    }))}
                    index="mes"
                    categories={['Pharsana', 'Ampofrasca', 'Proy. PET']}
                    valueFormatter={(v) => formatCurrency(v)}
                  />
                  <BarChartCard
                    title="Ventas por Sociedad (Actual vs Anterior)"
                    data={charts.ventasSociedad.map((r) => ({
                      sociedad: sociedadLabel(String(r.sociedad)),
                      'Mes Actual': Number(r.mes_actual),
                      'Mes Anterior': Number(r.mes_anterior),
                    }))}
                    index="sociedad"
                    categories={['Mes Actual', 'Mes Anterior']}
                    valueFormatter={(v) => formatCurrency(v)}
                  />
                  <BarListCard
                    title="Top 10 Clientes (Ventas USD)"
                    data={charts.topClientes}
                    valueFormatter={(v) => formatCurrency(v)}
                  />
                  <LineChartCard
                    title="Tendencia Ventas por Sociedad"
                    data={charts.ventasMensuales.map((r) => ({
                      mes: r.mes,
                      Pharsana: Number(r.sociedad_1000),
                      Ampofrasca: Number(r.sociedad_1200),
                      'Proy. PET': Number(r.sociedad_1300),
                    }))}
                    index="mes"
                    categories={['Pharsana', 'Ampofrasca', 'Proy. PET']}
                    valueFormatter={(v) => formatCurrency(v)}
                  />
                </div>
              </Tab>
              <Tab key="finanzas" title="Finanzas">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <DonutChartCard
                    title="Aging CxC"
                    data={charts.agingCxc}
                    valueFormatter={(v) => formatCurrency(v)}
                  />
                  <ComposedChartCard
                    title="CxC Total vs Vencida"
                    data={charts.agingCxc.map((r) => ({ bucket: r.name, Monto: r.value }))}
                    index="bucket"
                    bars={[{ key: 'Monto', color: '#006FEE' }]}
                    lines={[]}
                    valueFormatter={(v) => formatCurrency(v)}
                  />
                </div>
              </Tab>
              <Tab key="operaciones" title="Operaciones">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <DonutChartCard
                    title="Pedidos por Estatus"
                    data={charts.pedidosStatus}
                  />
                  <BarChartCard
                    title="Ordenes por Centro y Estatus"
                    data={charts.ordenesCentro.map((r) => ({
                      centro: String(r.centro),
                      Abiertas: Number(r.abiertas),
                      Liberadas: Number(r.liberadas),
                      Cerradas: Number(r.cerradas),
                    }))}
                    index="centro"
                    categories={['Abiertas', 'Liberadas', 'Cerradas']}
                    stacked
                  />
                </div>
              </Tab>
            </Tabs>
          )}
        </>
      )}
    </div>
  )
}

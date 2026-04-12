import {
  DollarSign, CreditCard, AlertTriangle, Package, Factory, ShoppingCart,
} from 'lucide-react'
import { Tabs, Tab } from '@heroui/react'
import { useMemo } from 'react'
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
import { useUiStore } from '../stores/uiStore'
import { formatCurrency, formatNumber, sociedadLabel } from '../lib/formatters'

export default function DashboardPage() {
  const kpis = useDashboardKPIs()
  const charts = useDashboardCharts()
  const selectedSociedad = useUiStore((s) => s.selectedSociedad)
  const centerLabel = (value: unknown) => {
    const normalized = String(value ?? '').trim()
    return normalized && normalized.toLowerCase() !== 'null' ? normalized : 'Sin centro'
  }
  const selectedSociedadLabel = selectedSociedad ? sociedadLabel(selectedSociedad) : null
  const monthlySalesMatrix = useMemo(
    () => charts.ventasMensuales.map((r) => ({
      mes: r.mes,
      sociedad_1000: Number(r.sociedad_1000 ?? 0),
      sociedad_1200: Number(r.sociedad_1200 ?? 0),
      sociedad_1300: Number(r.sociedad_1300 ?? 0),
      total: Number((r as { total?: number }).total ?? 0),
    })),
    [charts.ventasMensuales],
  )
  const salesTrendCategories = selectedSociedadLabel
    ? [selectedSociedadLabel]
    : ['Pharsana', 'Ampofrasca', 'Proy. PET']
  const salesTrendData = useMemo(
    () => monthlySalesMatrix.map((r) => (
      selectedSociedadLabel
        ? {
            mes: r.mes,
            [selectedSociedadLabel]: r.total,
          }
        : {
            mes: r.mes,
            Pharsana: r.sociedad_1000,
            Ampofrasca: r.sociedad_1200,
            'Proy. PET': r.sociedad_1300,
          }
    )),
    [monthlySalesMatrix, selectedSociedadLabel],
  )
  const salesComparisonData = useMemo(
    () => charts.ventasSociedad.map((r) => ({
      sociedad: selectedSociedadLabel || sociedadLabel(String(r.sociedad || 'Sin clasificar')),
      'Mes Actual': Number(r.mes_actual),
      'Mes Anterior': Number(r.mes_anterior),
    })),
    [charts.ventasSociedad, selectedSociedadLabel],
  )

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
                    data={salesTrendData}
                    index="mes"
                    categories={salesTrendCategories}
                    valueFormatter={(v) => formatCurrency(v)}
                  />
                  <BarChartCard
                    title="Ventas por Sociedad (Actual vs Anterior)"
                    data={salesComparisonData}
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
                    data={salesTrendData}
                    index="mes"
                    categories={salesTrendCategories}
                    valueFormatter={(v) => formatCurrency(v)}
                  />
                </div>
              </Tab>
              <Tab key="finanzas" title="Finanzas">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <DonutChartCard
                    title="Antigüedad CxC"
                    data={charts.agingCxc}
                    valueFormatter={(v) => formatCurrency(v)}
                  />
                  <ComposedChartCard
                    title="CxC Total vs Vencida"
                    data={charts.agingCxc.map((r) => ({ bucket: r.name, Monto: r.value }))}
                    index="bucket"
                    bars={[{ key: 'Monto', color: '#091B6B' }]}
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
                      centro: centerLabel(r.centro),
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

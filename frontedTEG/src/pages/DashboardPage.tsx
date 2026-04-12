import {
  DollarSign, CreditCard, AlertTriangle, Package, Factory, ShoppingCart, Sparkles,
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
import { HeatmapChartCard } from '../components/charts/HeatmapChartCard'
import { TreemapChartCard } from '../components/charts/TreemapChartCard'
import { useDashboardKPIs, useDashboardCharts } from '../api/hooks/useDashboardKPIs'
import { formatCompactCurrency, formatCompactNumber, formatCurrency, formatNumber, sociedadLabel } from '../lib/formatters'

export default function DashboardPage() {
  const kpis = useDashboardKPIs()
  const charts = useDashboardCharts()
  const centerLabel = (value: unknown) => {
    const normalized = String(value ?? '').trim()
    return normalized && normalized.toLowerCase() !== 'null' ? normalized : 'Sin centro'
  }
  const monthlySalesMatrix = useMemo(
    () => charts.ventasMensuales.map((r) => ({
      mes: r.mes,
      sociedad_1000: Number(r.sociedad_1000),
      sociedad_1200: Number(r.sociedad_1200),
      sociedad_1300: Number(r.sociedad_1300),
    })),
    [charts.ventasMensuales],
  )
  const orderStatusLabels = ['Abiertas', 'Liberadas', 'Cerradas']
  const orderCenterLabels = useMemo(
    () => charts.ordenesCentro.map((row) => centerLabel(row.centro)),
    [charts.ordenesCentro],
  )
  const orderHeatmap = useMemo(
    () => charts.ordenesCentro.flatMap((row) => ([
      {
        x: centerLabel(row.centro),
        y: 'Abiertas',
        value: Number(row.abiertas),
      },
      {
        x: centerLabel(row.centro),
        y: 'Liberadas',
        value: Number(row.liberadas),
      },
      {
        x: centerLabel(row.centro),
        y: 'Cerradas',
        value: Number(row.cerradas),
      },
    ])),
    [charts.ordenesCentro],
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
            <>
              <section className="mb-8">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary/75">
                      <Sparkles className="h-3.5 w-3.5" />
                      Insights visuales
                    </div>
                    <h2 className="mt-3 text-xl font-semibold text-foreground">Nuevos gráficos ejecutivos</h2>
                    <p className="mt-1 text-sm text-default-500">
                      Una lectura rápida de concentración comercial y carga operativa por centro.
                    </p>
                  </div>
                  <p className="max-w-xl text-sm text-default-500">
                    Estos gráficos usan Apache ECharts para sumar visualizaciones más modernas sin reemplazar el resto del dashboard.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <HeatmapChartCard
                    title="Mapa de calor de órdenes"
                    subtitle="Resalta qué centros concentran el mayor volumen por estatus."
                    xLabels={orderCenterLabels}
                    yLabels={orderStatusLabels}
                    data={orderHeatmap}
                    valueFormatter={(v) => formatNumber(v)}
                    compactValueFormatter={(v) => formatCompactNumber(v)}
                    insightLabel="Mayor carga"
                  />
                  <TreemapChartCard
                    title="Concentración de clientes"
                    subtitle="Muestra qué cuentas explican más ventas del trimestre reciente."
                    data={charts.topClientes}
                    valueFormatter={(v) => formatCurrency(v)}
                    compactValueFormatter={(v) => formatCompactCurrency(v)}
                  />
                </div>
              </section>

              <Tabs aria-label="Dashboard sections" color="primary" variant="underlined" classNames={{ tabList: 'mb-6' }}>
                <Tab key="ventas" title="Ventas">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <AreaChartCard
                      title="Ventas Mensuales (12 meses)"
                      data={monthlySalesMatrix.map((r) => ({
                        mes: r.mes,
                        Pharsana: r.sociedad_1000,
                        Ampofrasca: r.sociedad_1200,
                        'Proy. PET': r.sociedad_1300,
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
                      data={monthlySalesMatrix.map((r) => ({
                        mes: r.mes,
                        Pharsana: r.sociedad_1000,
                        Ampofrasca: r.sociedad_1200,
                        'Proy. PET': r.sociedad_1300,
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
            </>
          )}
        </>
      )}
    </div>
  )
}

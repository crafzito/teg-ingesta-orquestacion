import {
  DollarSign, CreditCard, AlertTriangle, Package, Factory, ShoppingCart, Sparkles,
} from 'lucide-react'
import { Tabs, Tab } from '@heroui/react'
import { useMemo } from 'react'
import {
  AreaChart as TremorAreaChart,
  BarChart as TremorBarChart,
  BarList as TremorBarList,
  BadgeDelta,
  Card as TremorCard,
  Flex as TremorFlex,
  Metric as TremorMetric,
  Text as TremorText,
  Title as TremorTitle,
} from '@tremor/react'
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
import { formatCompactCurrency, formatCompactNumber, formatCurrency, formatNumber, sociedadLabel } from '../lib/formatters'

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
  const orderStatusLabels = ['Abiertas', 'Liberadas', 'Cerradas']
  const trendValueForPoint = (point?: Record<string, string | number>) => (
    salesTrendCategories.reduce((total, category) => total + Number(point?.[category] ?? 0), 0)
  )
  const latestTrendPoint = salesTrendData[salesTrendData.length - 1] as Record<string, string | number> | undefined
  const previousTrendPoint = salesTrendData[salesTrendData.length - 2] as Record<string, string | number> | undefined
  const currentTrendTotal = trendValueForPoint(latestTrendPoint)
  const previousTrendTotal = trendValueForPoint(previousTrendPoint)
  const trendDelta = previousTrendTotal > 0
    ? ((currentTrendTotal - previousTrendTotal) / previousTrendTotal) * 100
    : 0
  const trendDeltaType = trendDelta > 0 ? 'increase' : trendDelta < 0 ? 'decrease' : 'unchanged'
  const topClientsBars = useMemo(
    () => charts.topClientes.map((item, index) => ({
      name: item.name,
      value: item.value,
      color: index === 0 ? 'blue' : index < 3 ? 'cyan' : 'slate',
    })),
    [charts.topClientes],
  )
  const orderStatusChartData = useMemo(
    () => charts.ordenesCentro
      .map((row) => ({
        centro: centerLabel(row.centro),
        Abiertas: Number(row.abiertas),
        Liberadas: Number(row.liberadas),
        Cerradas: Number(row.cerradas),
        total: Number(row.abiertas) + Number(row.liberadas) + Number(row.cerradas),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6),
    [charts.ordenesCentro],
  )
  const orderLoadVisible = orderStatusChartData.reduce((total, row) => total + row.total, 0)
  const topCustomerTotal = topClientsBars[0]?.value ?? 0

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
                      Una lectura rápida del pulso comercial y la presión operativa con una capa visual más cuidada.
                    </p>
                  </div>
                  <p className="max-w-xl text-sm text-default-500">
                    Esta sección usa Tremor para sumar gráficos más limpios sin tocar los charts del resto del dashboard.
                  </p>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)] gap-6">
                  <TremorCard
                    decoration="top"
                    decorationColor="indigo"
                    className="border border-white/10 bg-white/90 shadow-lg shadow-slate-950/5 backdrop-blur dark:border-white/10 dark:bg-slate-950/75"
                  >
                    <TremorFlex justifyContent="between" alignItems="start" className="gap-4">
                      <div>
                        <TremorText>Pulso comercial</TremorText>
                        <TremorTitle className="mt-1">Ventas recientes con lectura continua</TremorTitle>
                        <TremorText className="mt-2">
                          {selectedSociedadLabel
                            ? `Evolución mensual para ${selectedSociedadLabel}.`
                            : 'Comparativa de ventas mensuales entre las sociedades visibles.'}
                        </TremorText>
                      </div>
                      <BadgeDelta deltaType={trendDeltaType}>
                        {formatNumber(Math.abs(trendDelta), 1)}%
                      </BadgeDelta>
                    </TremorFlex>
                    <TremorMetric className="mt-4">{formatCurrency(currentTrendTotal)}</TremorMetric>
                    <TremorText className="mt-1">
                      Último corte disponible {previousTrendTotal > 0 ? `vs ${formatCurrency(previousTrendTotal)} anterior` : ''}
                    </TremorText>
                    <TremorAreaChart
                      className="mt-6 h-72"
                      data={salesTrendData}
                      index="mes"
                      categories={salesTrendCategories}
                      colors={selectedSociedadLabel ? ['blue'] : ['blue', 'cyan', 'violet']}
                      valueFormatter={(value: number) => formatCompactCurrency(value)}
                      showGradient
                      showLegend
                      curveType="monotone"
                      yAxisWidth={64}
                      noDataText="Sin datos para este filtro"
                    />
                  </TremorCard>

                  <div className="grid grid-cols-1 gap-6">
                    <TremorCard
                      decoration="top"
                      decorationColor="cyan"
                      className="border border-white/10 bg-white/90 shadow-lg shadow-slate-950/5 backdrop-blur dark:border-white/10 dark:bg-slate-950/75"
                    >
                      <TremorText>Clientes que mueven el periodo</TremorText>
                      <TremorTitle className="mt-1">Concentración comercial</TremorTitle>
                      <TremorMetric className="mt-4">{formatCurrency(topCustomerTotal)}</TremorMetric>
                      <TremorText className="mt-1">Mayor cuenta visible en los últimos 90 días.</TremorText>
                      <TremorBarList
                        className="mt-6"
                        data={topClientsBars}
                        valueFormatter={(value: number) => formatCompactCurrency(value)}
                        sortOrder="descending"
                      />
                    </TremorCard>

                    <TremorCard
                      decoration="top"
                      decorationColor="emerald"
                      className="border border-white/10 bg-white/90 shadow-lg shadow-slate-950/5 backdrop-blur dark:border-white/10 dark:bg-slate-950/75"
                    >
                      <TremorText>Carga operativa</TremorText>
                      <TremorTitle className="mt-1">Centros con más presión</TremorTitle>
                      <TremorMetric className="mt-4">{formatNumber(orderLoadVisible)}</TremorMetric>
                      <TremorText className="mt-1">Top 6 centros por órdenes abiertas, liberadas y cerradas.</TremorText>
                      <TremorBarChart
                        className="mt-6 h-72"
                        data={orderStatusChartData}
                        index="centro"
                        categories={orderStatusLabels}
                        colors={['amber', 'blue', 'emerald']}
                        stack
                        valueFormatter={(value: number) => formatCompactNumber(value)}
                        yAxisWidth={48}
                        noDataText="Sin datos para este filtro"
                      />
                    </TremorCard>
                  </div>
                </div>
              </section>

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
            </>
          )}
        </>
      )}
    </div>
  )
}

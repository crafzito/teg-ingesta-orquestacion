import {
  DollarSign, CreditCard, AlertTriangle, Package, Factory, ShoppingCart,
} from 'lucide-react'
import { Tabs, Tab } from '@heroui/react'
import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area, LineChart, Line,
} from 'recharts'
import { PageHeader } from '../components/ui/PageHeader'
import { FilterBar } from '../components/dashboard/FilterBar'
import { KPICard } from '../components/dashboard/KPICard'
import { ChartCard } from '../components/dashboard/ChartCard'
import { ChartTooltip } from '../components/dashboard/ChartTooltip'
import { CHART_COLORS } from '../components/dashboard/palette'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { BarListCard } from '../components/charts/BarListCard'
import { useDashboardKPIs, useDashboardCharts } from '../api/hooks/useDashboardKPIs'
import { useUiStore } from '../stores/uiStore'
import { formatCurrency, formatNumber, formatPercent, sociedadLabel } from '../lib/formatters'

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

  const ventasSparkline = useMemo(
    () => monthlySalesMatrix.slice(-12).map((r) => r.total),
    [monthlySalesMatrix],
  )
  const ventasTrendDelta = useMemo(() => {
    if (monthlySalesMatrix.length < 2) return undefined
    const last = monthlySalesMatrix[monthlySalesMatrix.length - 1]?.total ?? 0
    const prev = monthlySalesMatrix[monthlySalesMatrix.length - 2]?.total ?? 0
    if (prev <= 0) return undefined
    return ((last - prev) / prev) * 100
  }, [monthlySalesMatrix])

  const cxcVencidaRatio = kpis.cxcTotal > 0 ? (kpis.cxcVencida / kpis.cxcTotal) * 100 : 0

  const ventasComposicion = useMemo(() => {
    const total = monthlySalesMatrix.reduce(
      (acc, r) => ({
        Pharsana: acc.Pharsana + r.sociedad_1000,
        Ampofrasca: acc.Ampofrasca + r.sociedad_1200,
        'Proy. PET': acc['Proy. PET'] + r.sociedad_1300,
      }),
      { Pharsana: 0, Ampofrasca: 0, 'Proy. PET': 0 },
    )
    return [
      { name: 'Pharsana', value: total.Pharsana },
      { name: 'Ampofrasca', value: total.Ampofrasca },
      { name: 'Proy. PET', value: total['Proy. PET'] },
    ].filter((d) => d.value > 0)
  }, [monthlySalesMatrix])

  const inventarioPorCentro = useMemo(
    () => charts.ordenesCentro.map((r) => ({
      centro: centerLabel(r.centro),
      'Activas': Number(r.abiertas) + Number(r.liberadas),
      'Cerradas': Number(r.cerradas),
    })),
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <KPICard
              title="Ventas del Mes"
              value={formatCurrency(kpis.ventasMes)}
              icon={<DollarSign className="h-5 w-5" />}
              accent="success"
              trend={ventasTrendDelta}
              sparkline={ventasSparkline}
              index={0}
            />
            <KPICard
              title="CxC Total"
              value={formatCurrency(kpis.cxcTotal)}
              icon={<CreditCard className="h-5 w-5" />}
              accent="primary"
              index={1}
            />
            <KPICard
              title="CxC Vencida"
              value={formatCurrency(kpis.cxcVencida)}
              icon={<AlertTriangle className="h-5 w-5" />}
              accent="accent"
              hint={`${cxcVencidaRatio.toFixed(1)}% del total`}
              index={2}
            />
            <KPICard
              title="Inventario Valor"
              value={formatCurrency(kpis.inventarioValor)}
              icon={<Package className="h-5 w-5" />}
              accent="warning"
              index={3}
            />
            <KPICard
              title="Ordenes Activas"
              value={formatNumber(kpis.ordenesActivas)}
              icon={<Factory className="h-5 w-5" />}
              accent="violet"
              index={4}
            />
            <KPICard
              title="Pedidos del Mes"
              value={formatNumber(kpis.pedidosMes)}
              icon={<ShoppingCart className="h-5 w-5" />}
              accent="pink"
              index={5}
            />
          </div>

          {charts.isLoading ? (
            <LoadingSpinner />
          ) : (
            <Tabs aria-label="Dashboard sections" color="primary" variant="underlined" classNames={{ tabList: 'mb-5' }}>
              <Tab key="ventas" title="Ventas">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <ChartCard
                    title="Tendencia Ventas"
                    subtitle="Ultimos 12 meses por sociedad"
                    index={0}
                    height="md"
                    className="lg:col-span-2"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={salesTrendData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                        <defs>
                          {salesTrendCategories.map((cat, i) => (
                            <linearGradient key={cat} id={`grad-tend-${i}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.4} />
                              <stop offset="95%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                        <YAxis tick={{ fontSize: 11 }} stroke="#a1a1aa" tickFormatter={(v) => formatCurrency(v)} />
                        <Tooltip content={<ChartTooltip valueFormatter={(v) => formatCurrency(v)} />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {salesTrendCategories.map((cat, i) => (
                          <Area
                            key={cat}
                            type="monotone"
                            dataKey={cat}
                            stroke={CHART_COLORS[i % CHART_COLORS.length]}
                            fill={`url(#grad-tend-${i})`}
                            strokeWidth={2}
                          />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard
                    title="Composicion por Sociedad"
                    subtitle="Mix de ventas acumuladas"
                    index={1}
                    height="md"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={ventasComposicion}
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={78}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="none"
                        >
                          {ventasComposicion.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip valueFormatter={(v) => formatCurrency(v)} />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard
                    title="Ventas por Sociedad"
                    subtitle="Mes actual vs mes anterior"
                    index={2}
                    height="md"
                    className="lg:col-span-2"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={salesComparisonData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="sociedad" tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                        <YAxis tick={{ fontSize: 11 }} stroke="#a1a1aa" tickFormatter={(v) => formatCurrency(v)} />
                        <Tooltip content={<ChartTooltip valueFormatter={(v) => formatCurrency(v)} />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="Mes Actual" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Mes Anterior" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.15, ease: 'easeOut' }}
                  >
                    <BarListCard
                      title="Top 10 Clientes"
                      data={charts.topClientes}
                      valueFormatter={(v) => formatCurrency(v)}
                    />
                  </motion.div>

                  <ChartCard
                    title="Tendencia Lineal"
                    subtitle="Ventas mensuales por sociedad"
                    index={4}
                    height="md"
                    className="lg:col-span-3"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={salesTrendData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                        <YAxis tick={{ fontSize: 11 }} stroke="#a1a1aa" tickFormatter={(v) => formatCurrency(v)} />
                        <Tooltip content={<ChartTooltip valueFormatter={(v) => formatCurrency(v)} />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {salesTrendCategories.map((cat, i) => (
                          <Line
                            key={cat}
                            type="monotone"
                            dataKey={cat}
                            stroke={CHART_COLORS[i % CHART_COLORS.length]}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
              </Tab>

              <Tab key="finanzas" title="Finanzas">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <ChartCard
                    title="Antiguedad CxC"
                    subtitle="Distribucion por antiguedad"
                    index={0}
                    height="md"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={charts.agingCxc}
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={78}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="none"
                        >
                          {charts.agingCxc.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip valueFormatter={(v) => formatCurrency(v)} />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard
                    title="Ratio CxC Vencida"
                    subtitle="Vencida sobre total"
                    index={1}
                    height="md"
                    className="lg:col-span-2"
                  >
                    <div className="flex h-full flex-col justify-center px-3">
                      <div className="flex items-baseline justify-between mb-3">
                        <span className="text-3xl font-bold text-foreground">{formatPercent(cxcVencidaRatio)}</span>
                        <span className="text-xs text-default-500">{formatCurrency(kpis.cxcVencida)} vencido</span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-default-100">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(cxcVencidaRatio, 100)}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className="h-full rounded-full"
                          style={{
                            background: `linear-gradient(90deg, ${CHART_COLORS[2]} 0%, ${CHART_COLORS[3]} 60%, ${CHART_COLORS[1]} 100%)`,
                          }}
                        />
                      </div>
                      <div className="mt-2 flex justify-between text-[11px] text-default-400">
                        <span>0%</span>
                        <span>50%</span>
                        <span>100%</span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-default-100 pt-3 text-xs">
                        <div>
                          <p className="text-default-500">CxC Total</p>
                          <p className="mt-1 font-semibold text-foreground">{formatCurrency(kpis.cxcTotal)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-default-500">CxC Vencida</p>
                          <p className="mt-1 font-semibold text-foreground">{formatCurrency(kpis.cxcVencida)}</p>
                        </div>
                      </div>
                    </div>
                  </ChartCard>

                  <ChartCard
                    title="CxC por Bucket"
                    subtitle="Monto en cada rango de antiguedad"
                    index={2}
                    height="md"
                    className="lg:col-span-3"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={charts.agingCxc.map((r) => ({ bucket: r.name, Monto: r.value }))}
                        margin={{ top: 5, right: 16, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="bucket" tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                        <YAxis tick={{ fontSize: 11 }} stroke="#a1a1aa" tickFormatter={(v) => formatCurrency(v)} />
                        <Tooltip content={<ChartTooltip valueFormatter={(v) => formatCurrency(v)} />} />
                        <Bar dataKey="Monto" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
              </Tab>

              <Tab key="operaciones" title="Operaciones">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <ChartCard
                    title="Pedidos por Estatus"
                    subtitle="Distribucion actual"
                    index={0}
                    height="md"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={charts.pedidosStatus}
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={78}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="none"
                        >
                          {charts.pedidosStatus.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip valueFormatter={(v) => formatNumber(v)} />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard
                    title="Ordenes por Centro"
                    subtitle="Activas vs cerradas"
                    index={1}
                    height="md"
                    className="lg:col-span-2"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={inventarioPorCentro} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="centro" tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                        <YAxis tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                        <Tooltip content={<ChartTooltip valueFormatter={(v) => formatNumber(v)} />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="Activas" stackId="a" fill={CHART_COLORS[0]} />
                        <Bar dataKey="Cerradas" stackId="a" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard
                    title="Ordenes por Centro y Estatus"
                    subtitle="Detalle apilado"
                    index={2}
                    height="md"
                    className="lg:col-span-3"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={charts.ordenesCentro.map((r) => ({
                          centro: centerLabel(r.centro),
                          Abiertas: Number(r.abiertas),
                          Liberadas: Number(r.liberadas),
                          Cerradas: Number(r.cerradas),
                        }))}
                        margin={{ top: 5, right: 16, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="centro" tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                        <YAxis tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                        <Tooltip content={<ChartTooltip valueFormatter={(v) => formatNumber(v)} />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="Abiertas" stackId="o" fill={CHART_COLORS[0]} />
                        <Bar dataKey="Liberadas" stackId="o" fill={CHART_COLORS[3]} />
                        <Bar dataKey="Cerradas" stackId="o" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
              </Tab>
            </Tabs>
          )}
        </>
      )}
    </div>
  )
}

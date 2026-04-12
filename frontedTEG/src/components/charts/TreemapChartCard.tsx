import { useMemo } from 'react'
import type { EChartsOption } from 'echarts'
import { EChartCard } from './EChartCard'

const TREEMAP_COLORS = ['#091B6B', '#0E793C', '#2563EB', '#F97316', '#7C3AED', '#EC4899', '#0891B2', '#65A30D']

interface TreemapChartCardProps {
  title: string
  subtitle?: string
  data: { name: string; value: number }[]
  valueFormatter: (value: number) => string
  compactValueFormatter: (value: number) => string
}

function truncateLabel(value: string, max = 22) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

export function TreemapChartCard({
  title,
  subtitle,
  data,
  valueFormatter,
  compactValueFormatter,
}: TreemapChartCardProps) {
  const chart = useMemo(() => {
    const normalized = data
      .map((item) => ({ ...item, value: Number(item.value) || 0 }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)

    const total = normalized.reduce((sum, item) => sum + item.value, 0)
    const topThree = normalized.slice(0, 3).reduce((sum, item) => sum + item.value, 0)
    const share = total > 0 ? (topThree / total) * 100 : 0

    const option: EChartsOption = {
      animationDuration: 550,
      animationEasing: 'quarticOut',
      tooltip: {
        backgroundColor: 'rgba(9, 27, 107, 0.94)',
        borderWidth: 0,
        textStyle: { color: '#F8FAFC' },
        formatter: (params: any) => {
          const value = Number(params.value ?? 0)
          const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
          return [
            `<div style="font-weight:600;margin-bottom:6px">${params.name}</div>`,
            `<div>${valueFormatter(value)}</div>`,
            `<div style="margin-top:6px;font-size:12px;color:#cbd5e1">${pct}% del top 10</div>`,
          ].join('')
        },
      },
      series: [
        {
          type: 'treemap',
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          visibleMin: 40,
          label: {
            show: true,
            overflow: 'break',
            lineHeight: 18,
            formatter: (params: any) => `${truncateLabel(params.name)}\n${compactValueFormatter(Number(params.value ?? 0))}`,
            color: '#f8fafc',
            fontWeight: 700,
            fontSize: 12,
          },
          upperLabel: { show: false },
          itemStyle: {
            borderColor: 'rgba(255,255,255,0.72)',
            borderWidth: 3,
            gapWidth: 6,
            borderRadius: 18,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 28,
              shadowColor: 'rgba(15, 23, 42, 0.22)',
            },
          },
          levels: [
            {
              colorSaturation: [0.4, 0.78],
              itemStyle: {
                borderWidth: 4,
                gapWidth: 7,
                borderRadius: 20,
              },
            },
          ],
          data: normalized.map((item, index) => ({
            ...item,
            itemStyle: {
              color: TREEMAP_COLORS[index % TREEMAP_COLORS.length],
            },
          })),
        },
      ],
    }

    return {
      option,
      isEmpty: normalized.length === 0,
      insightValue: `${share.toFixed(1)}% del total`,
    }
  }, [compactValueFormatter, data, valueFormatter])

  return (
    <EChartCard
      title={title}
      subtitle={subtitle}
      option={chart.option}
      isEmpty={chart.isEmpty}
      insightLabel="Top 3"
      insightValue={chart.insightValue}
      emptyText="No hay clientes con ventas recientes para construir el treemap."
    />
  )
}

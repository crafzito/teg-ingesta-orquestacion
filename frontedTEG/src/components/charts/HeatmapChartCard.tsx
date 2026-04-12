import { useMemo } from 'react'
import type { EChartsOption } from 'echarts'
import { EChartCard } from './EChartCard'

const HEATMAP_COLORS = ['#EEF4FF', '#C9DBFF', '#90B3FF', '#4F83FF', '#091B6B']

interface HeatmapChartCardProps {
  title: string
  subtitle?: string
  xLabels: string[]
  yLabels: string[]
  data: Array<{
    x: string
    y: string
    value: number
  }>
  valueFormatter: (value: number) => string
  compactValueFormatter: (value: number) => string
  insightLabel?: string
}

function tooltipValue(value: number, compactValueFormatter: (value: number) => string) {
  if (!Number.isFinite(value) || value <= 0) return '-'
  return compactValueFormatter(value)
}

export function HeatmapChartCard({
  title,
  subtitle,
  xLabels,
  yLabels,
  data,
  valueFormatter,
  compactValueFormatter,
  insightLabel = 'Mayor pico',
}: HeatmapChartCardProps) {
  const chart = useMemo(() => {
    const heatmapData = data
      .filter((item) => xLabels.includes(item.x) && yLabels.includes(item.y))
      .map((item) => [xLabels.indexOf(item.x), yLabels.indexOf(item.y), Number(item.value) || 0])

    const peak = heatmapData.reduce<{ x: number; y: number; value: number } | null>((current, point) => {
      const [, , rawValue] = point
      const value = Number(rawValue)
      if (!current || value > current.value) {
        return { x: Number(point[0]), y: Number(point[1]), value }
      }
      return current
    }, null)

    const maxValue = Math.max(...heatmapData.map((point) => Number(point[2])), 0)

    const option: EChartsOption = {
      animationDuration: 500,
      animationEasing: 'cubicOut',
      tooltip: {
        backgroundColor: 'rgba(9, 27, 107, 0.94)',
        borderWidth: 0,
        textStyle: { color: '#F8FAFC' },
        formatter: (params: any) => {
          const [xIndex, yIndex, rawValue] = params.value as [number, number, number]
          return [
            `<div style="font-weight:600;margin-bottom:6px">${yLabels[yIndex] ?? ''}</div>`,
            `<div style="font-size:12px;color:#cbd5e1">${xLabels[xIndex] ?? ''}</div>`,
            `<div style="margin-top:6px">${valueFormatter(Number(rawValue))}</div>`,
          ].join('')
        },
      },
      grid: {
        left: 84,
        right: 24,
        top: 24,
        bottom: 58,
      },
      xAxis: {
        type: 'category',
        data: xLabels,
        splitArea: { show: false },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#d4d4d8' } },
        axisLabel: { color: '#71717a', fontSize: 11 },
      },
      yAxis: {
        type: 'category',
        data: yLabels,
        splitArea: { show: false },
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { color: '#3f3f46', fontSize: 12, fontWeight: 600 },
      },
      visualMap: {
        min: 0,
        max: maxValue || 1,
        calculable: false,
        orient: 'horizontal',
        left: 'center',
        bottom: 8,
        itemWidth: 150,
        itemHeight: 10,
        text: ['Mayor', 'Menor'],
        textStyle: { color: '#71717a', fontSize: 11 },
        inRange: { color: HEATMAP_COLORS },
      },
      series: [
        {
          type: 'heatmap',
          data: heatmapData,
          label: {
            show: true,
            color: '#0f172a',
            fontSize: 10,
            fontWeight: 700,
            formatter: (params: any) => tooltipValue(Number(params.value[2]), compactValueFormatter),
          },
          itemStyle: {
            borderColor: 'rgba(255,255,255,0.85)',
            borderWidth: 2,
            borderRadius: 14,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 22,
              shadowColor: 'rgba(15, 23, 42, 0.18)',
            },
          },
        },
      ],
    }

    const insightValue = peak
      ? `${yLabels[peak.y]} · ${valueFormatter(peak.value)}`
      : 'Sin actividad registrada'

    return {
      option,
      insightValue,
      isEmpty: heatmapData.length === 0,
    }
  }, [compactValueFormatter, data, valueFormatter, xLabels, yLabels])

  return (
    <EChartCard
      title={title}
      subtitle={subtitle}
      option={chart.option}
      isEmpty={chart.isEmpty}
      insightLabel={insightLabel}
      insightValue={chart.insightValue}
      emptyText="No hay datos suficientes para construir el mapa de calor."
    />
  )
}

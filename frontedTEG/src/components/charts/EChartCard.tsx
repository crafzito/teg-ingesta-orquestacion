import { Card, CardBody, CardHeader } from '@heroui/react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'

interface EChartCardProps {
  title: string
  subtitle?: string
  insightLabel?: string
  insightValue?: string
  option: EChartsOption
  height?: number
  emptyText?: string
  isEmpty?: boolean
}

export function EChartCard({
  title,
  subtitle,
  insightLabel,
  insightValue,
  option,
  height = 320,
  emptyText = 'No hay datos disponibles para este gráfico.',
  isEmpty = false,
}: EChartCardProps) {
  return (
    <Card shadow="sm" className="border-none bg-gradient-to-br from-white via-white to-[#f4f7ff] dark:from-default-50 dark:via-default-100 dark:to-default-50">
      <CardHeader className="flex items-start justify-between gap-4 px-5 pb-0 pt-5">
        <div className="min-w-0">
          <h4 className="text-md font-semibold text-foreground">{title}</h4>
          {subtitle ? <p className="mt-1 text-sm text-default-500">{subtitle}</p> : null}
        </div>
        {insightLabel && insightValue ? (
          <div className="shrink-0 rounded-2xl border border-primary/15 bg-primary/5 px-3 py-2 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/70">{insightLabel}</p>
            <p className="mt-1 max-w-44 text-xs font-medium text-foreground">{insightValue}</p>
          </div>
        ) : null}
      </CardHeader>
      <CardBody className="px-3 pb-3 pt-3">
        {isEmpty ? (
          <div
            className="flex h-[320px] items-center justify-center rounded-2xl border border-dashed border-default-200 bg-default-50/70 px-6 text-center text-sm text-default-500"
            style={{ height }}
          >
            {emptyText}
          </div>
        ) : (
          <ReactECharts option={option} notMerge lazyUpdate style={{ height, width: '100%' }} />
        )}
      </CardBody>
    </Card>
  )
}

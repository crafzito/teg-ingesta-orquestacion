import { Card, CardBody, CardHeader } from '@heroui/react'
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts'

interface GaugeChartCardProps {
  title: string
  value: number
  valueLabel: string
  subtitle?: string
  helperText?: string
  min?: number
  max?: number
  color?: string
  leftLabel?: string
  leftValue?: string
  rightLabel?: string
  rightValue?: string
}

export function GaugeChartCard({
  title,
  value,
  valueLabel,
  subtitle,
  helperText,
  min = 0,
  max = 200,
  color = '#091B6B',
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
}: GaugeChartCardProps) {
  const boundedValue = Math.min(Math.max(value, min), max)

  return (
    <Card shadow="sm" className="border-none">
      <CardHeader className="pb-0 px-5 pt-5">
        <div>
          <h4 className="text-md font-semibold text-foreground">{title}</h4>
          {helperText ? <p className="text-xs text-default-500 mt-1">{helperText}</p> : null}
        </div>
      </CardHeader>
      <CardBody className="pt-2 px-3">
        <div className="relative h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              data={[{ value: boundedValue, fill: color }]}
              cx="50%"
              cy="56%"
              innerRadius="70%"
              outerRadius="100%"
              barSize={20}
              startAngle={210}
              endAngle={-30}
            >
              <PolarAngleAxis type="number" domain={[min, max]} tick={false} />
              <RadialBar dataKey="value" cornerRadius={12} background />
            </RadialBarChart>
          </ResponsiveContainer>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-6 text-center">
            <span className="text-3xl font-semibold tracking-tight text-foreground">{valueLabel}</span>
            {subtitle ? <span className="mt-1 text-xs text-default-500">{subtitle}</span> : null}
          </div>

          <div className="absolute inset-x-5 bottom-3 flex items-center justify-between text-xs text-default-500">
            <span>{min}%</span>
            <span>{max}%</span>
          </div>
        </div>

        {(leftValue || rightValue) ? (
          <div className="grid grid-cols-2 gap-3 border-t border-default-100 pt-3 text-xs">
            <div>
              {leftLabel ? <p className="text-default-500">{leftLabel}</p> : null}
              {leftValue ? <p className="mt-1 font-medium text-foreground">{leftValue}</p> : null}
            </div>
            <div className="text-right">
              {rightLabel ? <p className="text-default-500">{rightLabel}</p> : null}
              {rightValue ? <p className="mt-1 font-medium text-foreground">{rightValue}</p> : null}
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  )
}

import { Card, CardBody, CardHeader } from '@heroui/react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORS = ['#091B6B', '#00972E', '#FF4E00', '#F31260', '#7828C8', '#0E793C', '#71717a']

interface DonutChartCardProps {
  title: string
  data: { name: string; value: number }[]
  valueFormatter?: (value: number) => string
  maxItems?: number
  truncateAt?: number
}

function truncate(str: string, max = 18): string {
  return str.length > max ? str.slice(0, max) + '...' : str
}

export function DonutChartCard({ title, data, valueFormatter, maxItems = 8, truncateAt = 18 }: DonutChartCardProps) {
  const sliced = data.slice(0, maxItems).map((d) => ({
    ...d,
    short: truncate(d.name, truncateAt),
  }))

  return (
    <Card shadow="sm" className="border-none">
      <CardHeader className="pb-0 px-5 pt-5">
        <h4 className="text-md font-semibold text-foreground">{title}</h4>
      </CardHeader>
      <CardBody className="pt-2 px-2">
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={sliced}
                cx="50%"
                cy="40%"
                innerRadius={52}
                outerRadius={82}
                paddingAngle={2}
                dataKey="value"
                nameKey="short"
                stroke="none"
              >
                {sliced.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={valueFormatter ? (v: number) => valueFormatter(v) : undefined}
                labelFormatter={(_label) => {
                  const item = sliced.find((d) => d.short === _label)
                  return item?.name ?? _label
                }}
              />
              <Legend
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{ fontSize: 11, lineHeight: '16px', paddingTop: 8 }}
                iconSize={8}
                content={({ payload }) => (
                  <ul className="grid grid-cols-1 gap-x-3 gap-y-1 px-4 pt-2 text-[11px] leading-4 text-default-600 sm:grid-cols-2">
                    {(payload ?? []).map((entry, index) => {
                      const chartItem = entry.payload as { name?: string; short?: string; fill?: string } | undefined
                      const full = chartItem?.name ?? String(entry.value ?? '')
                      const short = chartItem?.short ?? truncate(full, truncateAt)
                      return (
                        <li key={`${full}-${index}`} className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: chartItem?.fill ?? entry.color ?? COLORS[index % COLORS.length] }}
                          />
                          <span className="truncate" title={full}>{short}</span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  )
}

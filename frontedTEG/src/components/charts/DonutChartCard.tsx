import { Card, CardBody, CardHeader } from '@heroui/react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORS = ['#091B6B', '#00972E', '#FF4E00', '#F31260', '#7828C8', '#0E793C', '#71717a']

interface DonutChartCardProps {
  title: string
  data: { name: string; value: number }[]
  valueFormatter?: (value: number) => string
  maxItems?: number
}

function truncate(str: string, max = 18): string {
  return str.length > max ? str.slice(0, max) + '...' : str
}

export function DonutChartCard({ title, data, valueFormatter, maxItems = 8 }: DonutChartCardProps) {
  const sliced = data.slice(0, maxItems).map((d) => ({
    ...d,
    short: truncate(d.name),
  }))

  return (
    <Card shadow="sm" className="border-none">
      <CardHeader className="pb-0 px-5 pt-5">
        <h4 className="text-md font-semibold text-foreground">{title}</h4>
      </CardHeader>
      <CardBody className="pt-2 px-2">
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={sliced}
                cx="50%"
                cy="45%"
                innerRadius={50}
                outerRadius={85}
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
                wrapperStyle={{ fontSize: 11, lineHeight: '16px' }}
                iconSize={8}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  )
}

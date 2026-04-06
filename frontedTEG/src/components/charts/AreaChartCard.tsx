import { Card, CardBody, CardHeader } from '@heroui/react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORS = ['#091B6B', '#00972E', '#FF4E00', '#F31260', '#7828C8', '#0E793C']

interface AreaChartCardProps {
  title: string
  data: Record<string, unknown>[]
  index: string
  categories: string[]
  valueFormatter?: (value: number) => string
}

export function AreaChartCard({ title, data, index, categories, valueFormatter }: AreaChartCardProps) {
  return (
    <Card shadow="sm" className="border-none">
      <CardHeader className="pb-0 px-5 pt-5">
        <h4 className="text-md font-semibold text-foreground">{title}</h4>
      </CardHeader>
      <CardBody className="pt-2 px-2">
        <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <defs>
              {categories.map((cat, i) => (
                <linearGradient key={cat} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey={index} tick={{ fontSize: 12 }} stroke="#a1a1aa" />
            <YAxis tick={{ fontSize: 12 }} stroke="#a1a1aa" tickFormatter={valueFormatter ? (v) => valueFormatter(v) : undefined} />
            <Tooltip formatter={valueFormatter ? (v: number) => valueFormatter(v) : undefined} />
            <Legend />
            {categories.map((cat, i) => (
              <Area
                key={cat}
                type="monotone"
                dataKey={cat}
                stroke={COLORS[i % COLORS.length]}
                fill={`url(#grad-${i})`}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  )
}

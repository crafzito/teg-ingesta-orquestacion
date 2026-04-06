import { Card, CardBody, CardHeader } from '@heroui/react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORS = ['#091B6B', '#00972E', '#FF4E00', '#F31260', '#7828C8']

interface BarChartCardProps {
  title: string
  data: Record<string, unknown>[]
  index: string
  categories: string[]
  valueFormatter?: (value: number) => string
  stacked?: boolean
  layout?: 'vertical' | 'horizontal'
}

export function BarChartCard({ title, data, index, categories, valueFormatter, stacked, layout }: BarChartCardProps) {
  const isHorizontal = layout === 'horizontal'
  return (
    <Card shadow="sm" className="border-none">
      <CardHeader className="pb-0 px-5 pt-5">
        <h4 className="text-md font-semibold text-foreground">{title}</h4>
      </CardHeader>
      <CardBody className="pt-2 px-2">
        <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout={isHorizontal ? 'vertical' : 'horizontal'} margin={{ top: 5, right: 20, left: isHorizontal ? 80 : 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            {isHorizontal ? (
              <>
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="#a1a1aa" tickFormatter={valueFormatter ? (v) => valueFormatter(v) : undefined} />
                <YAxis dataKey={index} type="category" tick={{ fontSize: 11 }} stroke="#a1a1aa" width={75} />
              </>
            ) : (
              <>
                <XAxis dataKey={index} tick={{ fontSize: 12 }} stroke="#a1a1aa" />
                <YAxis tick={{ fontSize: 12 }} stroke="#a1a1aa" tickFormatter={valueFormatter ? (v) => valueFormatter(v) : undefined} />
              </>
            )}
            <Tooltip formatter={valueFormatter ? (v: number) => valueFormatter(v) : undefined} />
            <Legend />
            {categories.map((cat, i) => (
              <Bar key={cat} dataKey={cat} fill={COLORS[i % COLORS.length]} stackId={stacked ? 'stack' : undefined} radius={stacked ? undefined : [4, 4, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  )
}

import { Card, CardBody, CardHeader } from '@heroui/react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORS = ['#006FEE', '#17C964', '#F5A524', '#F31260', '#7828C8']

interface LineChartCardProps {
  title: string
  data: Record<string, unknown>[]
  index: string
  categories: string[]
  valueFormatter?: (value: number) => string
}

export function LineChartCard({ title, data, index, categories, valueFormatter }: LineChartCardProps) {
  return (
    <Card shadow="sm" className="border-none">
      <CardHeader className="pb-0 px-5 pt-5">
        <h4 className="text-md font-semibold text-foreground">{title}</h4>
      </CardHeader>
      <CardBody className="pt-2 px-2">
        <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey={index} tick={{ fontSize: 12 }} stroke="#a1a1aa" />
            <YAxis tick={{ fontSize: 12 }} stroke="#a1a1aa" tickFormatter={valueFormatter ? (v) => valueFormatter(v) : undefined} />
            <Tooltip formatter={valueFormatter ? (v: number) => valueFormatter(v) : undefined} />
            <Legend />
            {categories.map((cat, i) => (
              <Line key={cat} type="monotone" dataKey={cat} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  )
}

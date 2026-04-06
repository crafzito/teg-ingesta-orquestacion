import { Card, CardBody, CardHeader } from '@heroui/react'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface ComposedChartCardProps {
  title: string
  data: Record<string, unknown>[]
  index: string
  bars: { key: string; color?: string }[]
  lines: { key: string; color?: string }[]
  valueFormatter?: (value: number) => string
}

export function ComposedChartCard({ title, data, index, bars, lines, valueFormatter }: ComposedChartCardProps) {
  return (
    <Card shadow="sm" className="border-none">
      <CardHeader className="pb-0 px-5 pt-5">
        <h4 className="text-md font-semibold text-foreground">{title}</h4>
      </CardHeader>
      <CardBody className="pt-2 px-2">
        <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey={index} tick={{ fontSize: 12 }} stroke="#a1a1aa" />
            <YAxis tick={{ fontSize: 12 }} stroke="#a1a1aa" tickFormatter={valueFormatter ? (v) => valueFormatter(v) : undefined} />
            <Tooltip formatter={valueFormatter ? (v: number) => valueFormatter(v) : undefined} />
            <Legend />
            {bars.map((b) => (
              <Bar key={b.key} dataKey={b.key} fill={b.color ?? '#091B6B'} radius={[4, 4, 0, 0]} />
            ))}
            {lines.map((l) => (
              <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color ?? '#F31260'} strokeWidth={2} dot={{ r: 3 }} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  )
}

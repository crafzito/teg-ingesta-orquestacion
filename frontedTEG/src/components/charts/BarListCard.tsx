import { Card, CardBody, CardHeader } from '@heroui/react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface BarListCardProps {
  title: string
  data: { name: string; value: number }[]
  valueFormatter?: (value: number) => string
  color?: string
  maxItems?: number
}

function truncate(str: string, max = 20): string {
  return str.length > max ? str.slice(0, max) + '...' : str
}

export function BarListCard({ title, data, valueFormatter, color = '#006FEE', maxItems = 10 }: BarListCardProps) {
  const sliced = data.slice(0, maxItems).map((d) => ({ ...d, short: truncate(d.name) }))

  return (
    <Card shadow="sm" className="border-none">
      <CardHeader className="pb-0 px-5 pt-5">
        <h4 className="text-md font-semibold text-foreground">{title}</h4>
      </CardHeader>
      <CardBody className="pt-2 px-2">
        <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sliced} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
            <XAxis type="number" tick={{ fontSize: 11 }} stroke="#a1a1aa" tickFormatter={valueFormatter ? (v) => valueFormatter(v) : undefined} />
            <YAxis dataKey="short" type="category" tick={{ fontSize: 11 }} stroke="#a1a1aa" width={130} />
            <Tooltip
              formatter={valueFormatter ? (v: number) => valueFormatter(v) : undefined}
              labelFormatter={(_label, payload) => payload?.[0]?.payload?.name ?? _label}
            />
            <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  )
}

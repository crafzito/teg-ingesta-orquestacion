import { Card, CardBody, CardHeader } from '@heroui/react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts'

const COLORS = ['#006FEE', '#17C964', '#F5A524']

interface RadarChartCardProps {
  title: string
  data: Record<string, unknown>[]
  index: string
  categories: string[]
}

export function RadarChartCard({ title, data, index, categories }: RadarChartCardProps) {
  return (
    <Card shadow="sm" className="border-none">
      <CardHeader className="pb-0 px-5 pt-5">
        <h4 className="text-md font-semibold text-foreground">{title}</h4>
      </CardHeader>
      <CardBody className="pt-2 px-2">
        <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="#e4e4e7" />
            <PolarAngleAxis dataKey={index} tick={{ fontSize: 11 }} />
            <PolarRadiusAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend />
            {categories.map((cat, i) => (
              <Radar key={cat} name={cat} dataKey={cat} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.2} />
            ))}
          </RadarChart>
        </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  )
}

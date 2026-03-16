import { Card, CardBody } from '@heroui/react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface KpiCardProps {
  title: string
  value: string
  icon: React.ReactNode
  trend?: number
}

export function KpiCard({ title, value, icon, trend }: KpiCardProps) {
  return (
    <Card shadow="sm" className="border-none">
      <CardBody className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-default-500 truncate">{title}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
            {trend !== undefined && (
              <div className={`mt-1 flex items-center text-sm ${trend >= 0 ? 'text-success' : 'text-danger'}`}>
                {trend >= 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                <span>{Math.abs(trend).toFixed(1)}%</span>
              </div>
            )}
          </div>
          <div className="ml-4 flex-shrink-0 p-3 rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

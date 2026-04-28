import { Card, CardBody } from '@heroui/react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { motion } from 'framer-motion'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { ACCENT_BG, ACCENT_TOKENS, type AccentKey } from './palette'

interface KPICardProps {
  title: string
  value: string
  icon: React.ReactNode
  accent?: AccentKey
  trend?: number
  sparkline?: number[]
  index?: number
  hint?: string
}

export function KPICard({
  title,
  value,
  icon,
  accent = 'primary',
  trend,
  sparkline,
  index = 0,
  hint,
}: KPICardProps) {
  const tone = ACCENT_BG[accent]
  const sparkColor = ACCENT_TOKENS[accent]
  const sparkData = sparkline && sparkline.length > 0
    ? sparkline.map((v, i) => ({ x: i, y: v }))
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: 'easeOut' }}
    >
      <Card shadow="sm" className="border-none overflow-hidden h-full min-h-[160px]">
        <CardBody className="p-4 sm:p-5 h-full flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-default-500 truncate">{title}</p>
              <p className="mt-1.5 text-xl sm:text-2xl font-bold text-foreground truncate">{value}</p>
            </div>
            <div className={`flex-shrink-0 p-2.5 rounded-xl ${tone}`}>{icon}</div>
          </div>
          <div className="mt-2 flex items-center gap-2 min-h-[20px]">
            {trend !== undefined && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                  trend >= 0 ? 'bg-[#00972E]/10 text-[#00972E]' : 'bg-danger/10 text-danger'
                }`}
              >
                {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(trend).toFixed(1)}%
              </span>
            )}
            {hint && <span className="text-[11px] text-default-400 truncate">{hint}</span>}
          </div>
          <div className="mt-2 -mx-1 h-12">
            {sparkData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`spark-${accent}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={sparkColor} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={sparkColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="y"
                    stroke={sparkColor}
                    strokeWidth={1.75}
                    fill={`url(#spark-${accent})`}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </CardBody>
      </Card>
    </motion.div>
  )
}

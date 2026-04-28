import { Card, CardBody, CardHeader } from '@heroui/react'
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface ChartCardProps {
  title: string
  subtitle?: string
  children: ReactNode
  actions?: ReactNode
  index?: number
  className?: string
  height?: 'sm' | 'md' | 'lg'
}

const HEIGHT_MAP = {
  sm: 'h-56',
  md: 'h-72',
  lg: 'h-80',
}

export function ChartCard({
  title,
  subtitle,
  children,
  actions,
  index = 0,
  className = '',
  height = 'md',
}: ChartCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: 'easeOut' }}
      className={className}
    >
      <Card shadow="sm" className="border-none h-full">
        <CardHeader className="flex items-start justify-between gap-2 px-5 pt-5 pb-2">
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-foreground truncate">{title}</h4>
            {subtitle ? (
              <p className="mt-0.5 text-xs text-default-500 truncate">{subtitle}</p>
            ) : null}
          </div>
          {actions ? <div className="flex-shrink-0">{actions}</div> : null}
        </CardHeader>
        <CardBody className="px-2 pt-1 pb-3">
          <div className={`w-full ${HEIGHT_MAP[height]}`}>{children}</div>
        </CardBody>
      </Card>
    </motion.div>
  )
}

import type { TooltipProps } from 'recharts'

interface ChartTooltipProps extends TooltipProps<number, string> {
  valueFormatter?: (value: number) => string
  labelFormatter?: (label: string) => string
}

export function ChartTooltip({ active, payload, label, valueFormatter, labelFormatter }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const formattedLabel = label != null ? (labelFormatter ? labelFormatter(String(label)) : String(label)) : ''

  return (
    <div
      className="rounded-lg border border-default-200/60 bg-background/95 px-3 py-2 shadow-lg backdrop-blur-sm"
      style={{ minWidth: 140 }}
    >
      {formattedLabel ? (
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-default-500">{formattedLabel}</p>
      ) : null}
      <ul className="space-y-1">
        {payload.map((entry, idx) => {
          const numericValue = typeof entry.value === 'number' ? entry.value : Number(entry.value ?? 0)
          const display = valueFormatter ? valueFormatter(numericValue) : String(entry.value ?? '')
          return (
            <li key={`${entry.name}-${idx}`} className="flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: entry.color ?? '#091B6B' }}
                />
                <span className="text-default-600">{entry.name}</span>
              </span>
              <span className="font-semibold text-foreground">{display}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

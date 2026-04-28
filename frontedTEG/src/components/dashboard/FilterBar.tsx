import { motion } from 'framer-motion'
import { Calendar, Building2, MapPin } from 'lucide-react'
import { useUiStore, type DateRangeKey } from '../../stores/uiStore'
import type { Sociedad } from '../../types/domain'

interface SegmentOption<T extends string> {
  value: T
  label: string
  short?: string
}

const SOCIEDAD_OPTIONS: SegmentOption<Sociedad>[] = [
  { value: '', label: 'Todas', short: 'Todas' },
  { value: '1000', label: 'Pharsana', short: 'Pharsana' },
  { value: '1200', label: 'Ampofrasca', short: 'Ampofrasca' },
  { value: '1300', label: 'Proy. PET', short: 'Proy. PET' },
]

const RANGE_OPTIONS: SegmentOption<DateRangeKey>[] = [
  { value: '30d', label: 'Ult. 30d' },
  { value: '90d', label: 'Ult. 90d' },
  { value: 'ytd', label: 'YTD' },
  { value: 'all', label: 'Todo' },
]

const CENTRO_OPTIONS: SegmentOption<string>[] = [
  { value: '', label: 'Todos' },
  { value: '1000', label: '1000' },
  { value: '1001', label: '1001' },
  { value: '1002', label: '1002' },
  { value: '1200', label: '1200' },
  { value: '1300', label: '1300' },
]

interface SegmentedProps<T extends string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
}

function Segmented<T extends string>({ options, value, onChange, ariaLabel }: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 rounded-full border border-default-200 bg-default-50/60 p-1"
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value || 'all'}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`relative px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              active ? 'text-white' : 'text-default-600 hover:text-foreground'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${ariaLabel}`}
                className="absolute inset-0 rounded-full bg-[#091B6B] shadow-sm"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <span className="relative z-10 whitespace-nowrap">{opt.short ?? opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

interface FilterBarProps {
  showCentro?: boolean
  showRange?: boolean
  sticky?: boolean
}

export function FilterBar({ showCentro = false, showRange = true, sticky = true }: FilterBarProps) {
  const selectedSociedad = useUiStore((s) => s.selectedSociedad)
  const setSociedad = useUiStore((s) => s.setSociedad)
  const selectedCentro = useUiStore((s) => s.selectedCentro)
  const setCentro = useUiStore((s) => s.setCentro)
  const selectedRange = useUiStore((s) => s.selectedRange)
  const setRange = useUiStore((s) => s.setRange)

  return (
    <div
      className={`${sticky ? 'sticky top-0 z-20' : ''} -mx-2 sm:-mx-4 mb-5 px-2 sm:px-4 py-3 backdrop-blur-md bg-background/80 border-b border-default-100`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-default-500">
            <Building2 className="h-3.5 w-3.5" /> Sociedad
          </span>
          <Segmented
            options={SOCIEDAD_OPTIONS}
            value={selectedSociedad}
            onChange={(v) => setSociedad(v as Sociedad)}
            ariaLabel="Sociedad"
          />
        </div>

        {showRange && (
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-default-500">
              <Calendar className="h-3.5 w-3.5" /> Rango
            </span>
            <Segmented
              options={RANGE_OPTIONS}
              value={selectedRange}
              onChange={setRange}
              ariaLabel="Rango temporal"
            />
          </div>
        )}

        {showCentro && (
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-default-500">
              <MapPin className="h-3.5 w-3.5" /> Centro
            </span>
            <Segmented
              options={CENTRO_OPTIONS}
              value={selectedCentro}
              onChange={setCentro}
              ariaLabel="Centro"
            />
          </div>
        )}
      </div>
    </div>
  )
}

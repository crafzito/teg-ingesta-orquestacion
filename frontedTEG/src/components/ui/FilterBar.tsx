import { Select, SelectItem } from '@heroui/react'
import { useUiStore } from '../../stores/uiStore'
import type { Sociedad } from '../../types/domain'

const SOCIEDADES = [
  { value: '', label: 'Todas las Sociedades' },
  { value: '1000', label: 'Pharsana (Consumo)' },
  { value: '1200', label: 'Ampofrasca (Empaque)' },
  { value: '1300', label: 'Proy. PET (Empaque)' },
]

export function FilterBar() {
  const { selectedSociedad, setSociedad } = useUiStore()

  return (
    <div className="flex items-center gap-3 mb-6">
      <Select
        label="Sociedad"
        selectedKeys={[selectedSociedad]}
        onChange={(e) => setSociedad(e.target.value as Sociedad)}
        className="max-w-xs"
        size="sm"
        variant="bordered"
      >
        {SOCIEDADES.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            {s.label}
          </SelectItem>
        ))}
      </Select>
    </div>
  )
}

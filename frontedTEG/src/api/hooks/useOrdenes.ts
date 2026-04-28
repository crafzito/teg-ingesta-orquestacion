import { useUiStore } from '../../stores/uiStore'
import { useQueryData } from './useQueryData'
import { queryOrdenes, queryOrdenesPorEstatus, queryOrdenesPorCentro } from '../queries/ordenes'
import type { OrdenRow } from '../../types/domain'

export function useOrdenesTable() {
  const soc = useUiStore((s) => s.selectedSociedad)
  const centro = useUiStore((s) => s.selectedCentro)
  const periodo = useUiStore((s) => s.selectedPeriodo)
  return useQueryData<OrdenRow>(['ordenes', 'table', soc, centro, periodo], queryOrdenes({ soc, centro, periodo }))
}

export function useOrdenesPorEstatus() {
  const soc = useUiStore((s) => s.selectedSociedad)
  const centro = useUiStore((s) => s.selectedCentro)
  const periodo = useUiStore((s) => s.selectedPeriodo)
  return useQueryData<{ estatus: string; total: number }>(
    ['ordenes', 'por-estatus', soc, centro, periodo], queryOrdenesPorEstatus({ soc, centro, periodo })
  )
}

export function useOrdenesPorCentro() {
  const soc = useUiStore((s) => s.selectedSociedad)
  const centro = useUiStore((s) => s.selectedCentro)
  const periodo = useUiStore((s) => s.selectedPeriodo)
  return useQueryData<{ centro: string; abiertas: number; liberadas: number; cerradas: number }>(
    ['ordenes', 'por-centro', soc, centro, periodo], queryOrdenesPorCentro({ soc, centro, periodo })
  )
}

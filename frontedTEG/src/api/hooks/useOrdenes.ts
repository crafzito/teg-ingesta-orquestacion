import { useUiStore } from '../../stores/uiStore'
import { useQueryData } from './useQueryData'
import { queryOrdenes, queryOrdenesPorEstatus, queryOrdenesPorCentro } from '../queries/ordenes'
import type { OrdenRow } from '../../types/domain'

export function useOrdenesTable() {
  const soc = useUiStore((s) => s.selectedSociedad)
  return useQueryData<OrdenRow>(['ordenes', 'table', soc], queryOrdenes(soc))
}

export function useOrdenesPorEstatus() {
  const soc = useUiStore((s) => s.selectedSociedad)
  return useQueryData<{ estatus: string; total: number }>(
    ['ordenes', 'por-estatus', soc], queryOrdenesPorEstatus(soc)
  )
}

export function useOrdenesPorCentro() {
  const soc = useUiStore((s) => s.selectedSociedad)
  return useQueryData<{ centro: string; abiertas: number; liberadas: number; cerradas: number }>(
    ['ordenes', 'por-centro', soc], queryOrdenesPorCentro(soc)
  )
}

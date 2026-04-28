import { useUiStore } from '../../stores/uiStore'
import { useQueryData } from './useQueryData'
import { queryClientes } from '../queries/clientes'
import type { ClienteRow } from '../../types/domain'

export function useClientesTable() {
  const soc = useUiStore((s) => s.selectedSociedad)
  const periodo = useUiStore((s) => s.selectedPeriodo)
  return useQueryData<ClienteRow>(['clientes', 'table', soc, periodo], queryClientes({ soc, periodo }))
}

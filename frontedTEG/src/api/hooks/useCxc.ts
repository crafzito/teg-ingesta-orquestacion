import { useUiStore } from '../../stores/uiStore'
import { useQueryData } from './useQueryData'
import { queryCxc, queryCxcAging, queryCxcPorCliente } from '../queries/cxc'
import type { CxcRow } from '../../types/domain'

export function useCxcTable() {
  const soc = useUiStore((s) => s.selectedSociedad)
  const periodo = useUiStore((s) => s.selectedPeriodo)
  return useQueryData<CxcRow>(['cxc', 'table', soc, periodo], queryCxc({ soc, periodo }))
}

export function useCxcAging() {
  const soc = useUiStore((s) => s.selectedSociedad)
  const periodo = useUiStore((s) => s.selectedPeriodo)
  return useQueryData<{ bucket: string; total: number; count: number }>(
    ['cxc', 'aging', soc, periodo], queryCxcAging({ soc, periodo })
  )
}

export function useCxcPorCliente() {
  const soc = useUiStore((s) => s.selectedSociedad)
  const periodo = useUiStore((s) => s.selectedPeriodo)
  return useQueryData<{ nombre: string; total: number; vencido: number; docs: number }>(
    ['cxc', 'por-cliente', soc, periodo], queryCxcPorCliente({ soc, periodo })
  )
}

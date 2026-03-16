import { useUiStore } from '../../stores/uiStore'
import { useQueryData } from './useQueryData'
import { queryCxc, queryCxcAging, queryCxcPorCliente } from '../queries/cxc'
import type { CxcRow } from '../../types/domain'

export function useCxcTable() {
  const soc = useUiStore((s) => s.selectedSociedad)
  return useQueryData<CxcRow>(['cxc', 'table', soc], queryCxc(soc))
}

export function useCxcAging() {
  const soc = useUiStore((s) => s.selectedSociedad)
  return useQueryData<{ bucket: string; total: number; count: number }>(
    ['cxc', 'aging', soc], queryCxcAging(soc)
  )
}

export function useCxcPorCliente() {
  const soc = useUiStore((s) => s.selectedSociedad)
  return useQueryData<{ nombre: string; total: number; vencido: number; docs: number }>(
    ['cxc', 'por-cliente', soc], queryCxcPorCliente(soc)
  )
}

import { useUiStore } from '../../stores/uiStore'
import { useQueryData } from './useQueryData'
import { queryCxp, queryCxpAging, queryCxpPorProveedor } from '../queries/cxp'
import type { CxpRow } from '../../types/domain'

export function useCxpTable() {
  const soc = useUiStore((s) => s.selectedSociedad)
  return useQueryData<CxpRow>(['cxp', 'table', soc], queryCxp(soc))
}

export function useCxpAging() {
  const soc = useUiStore((s) => s.selectedSociedad)
  return useQueryData<{ bucket: string; total: number; count: number }>(
    ['cxp', 'aging', soc], queryCxpAging(soc)
  )
}

export function useCxpPorProveedor() {
  const soc = useUiStore((s) => s.selectedSociedad)
  return useQueryData<{ nombre: string; total: number; docs: number }>(
    ['cxp', 'por-proveedor', soc], queryCxpPorProveedor(soc)
  )
}

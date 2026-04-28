import { useUiStore } from '../../stores/uiStore'
import { useQueryData } from './useQueryData'
import { queryCxp, queryCxpAging, queryCxpPorProveedor } from '../queries/cxp'
import type { CxpRow } from '../../types/domain'

export function useCxpTable() {
  const soc = useUiStore((s) => s.selectedSociedad)
  const periodo = useUiStore((s) => s.selectedPeriodo)
  return useQueryData<CxpRow>(['cxp', 'table', soc, periodo], queryCxp({ soc, periodo }))
}

export function useCxpAging() {
  const soc = useUiStore((s) => s.selectedSociedad)
  const periodo = useUiStore((s) => s.selectedPeriodo)
  return useQueryData<{ bucket: string; total: number; count: number }>(
    ['cxp', 'aging', soc, periodo], queryCxpAging({ soc, periodo })
  )
}

export function useCxpPorProveedor() {
  const soc = useUiStore((s) => s.selectedSociedad)
  const periodo = useUiStore((s) => s.selectedPeriodo)
  return useQueryData<{ nombre: string; total: number; docs: number }>(
    ['cxp', 'por-proveedor', soc, periodo], queryCxpPorProveedor({ soc, periodo })
  )
}

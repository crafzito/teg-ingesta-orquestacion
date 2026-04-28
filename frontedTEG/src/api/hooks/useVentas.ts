import { useUiStore } from '../../stores/uiStore'
import { useQueryData } from './useQueryData'
import { queryVentas, queryVentasPorMes, queryVentasPorCliente, queryVentasPorProducto } from '../queries/ventas'
import type { VentaRow } from '../../types/domain'

export function useVentasTable() {
  const soc = useUiStore((s) => s.selectedSociedad)
  const periodo = useUiStore((s) => s.selectedPeriodo)
  return useQueryData<VentaRow>(['ventas', 'table', soc, periodo], queryVentas({ soc, periodo }))
}

export function useVentasPorMes() {
  const soc = useUiStore((s) => s.selectedSociedad)
  const periodo = useUiStore((s) => s.selectedPeriodo)
  return useQueryData<{ mes: string; total: number; num_facturas: number }>(
    ['ventas', 'por-mes', soc, periodo], queryVentasPorMes({ soc, periodo })
  )
}

export function useVentasPorCliente() {
  const soc = useUiStore((s) => s.selectedSociedad)
  const periodo = useUiStore((s) => s.selectedPeriodo)
  return useQueryData<{ nombre: string; total: number; num_facturas: number }>(
    ['ventas', 'por-cliente', soc, periodo], queryVentasPorCliente({ soc, periodo })
  )
}

export function useVentasPorProducto() {
  const soc = useUiStore((s) => s.selectedSociedad)
  const periodo = useUiStore((s) => s.selectedPeriodo)
  return useQueryData<{ material: string; nombre: string; total: number; cantidad_total: number }>(
    ['ventas', 'por-producto', soc, periodo], queryVentasPorProducto({ soc, periodo })
  )
}

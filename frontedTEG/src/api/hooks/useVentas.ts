import { useUiStore } from '../../stores/uiStore'
import { useQueryData } from './useQueryData'
import { queryVentas, queryVentasPorMes, queryVentasPorCliente, queryVentasPorProducto } from '../queries/ventas'
import type { VentaRow } from '../../types/domain'

export function useVentasTable() {
  const soc = useUiStore((s) => s.selectedSociedad)
  return useQueryData<VentaRow>(['ventas', 'table', soc], queryVentas(soc))
}

export function useVentasPorMes() {
  const soc = useUiStore((s) => s.selectedSociedad)
  return useQueryData<{ mes: string; total: number; num_facturas: number }>(
    ['ventas', 'por-mes', soc], queryVentasPorMes(soc)
  )
}

export function useVentasPorCliente() {
  const soc = useUiStore((s) => s.selectedSociedad)
  return useQueryData<{ nombre: string; total: number; num_facturas: number }>(
    ['ventas', 'por-cliente', soc], queryVentasPorCliente(soc)
  )
}

export function useVentasPorProducto() {
  const soc = useUiStore((s) => s.selectedSociedad)
  return useQueryData<{ material: string; nombre: string; total: number; cantidad_total: number }>(
    ['ventas', 'por-producto', soc], queryVentasPorProducto(soc)
  )
}

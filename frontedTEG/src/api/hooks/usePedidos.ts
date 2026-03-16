import { useUiStore } from '../../stores/uiStore'
import { useQueryData } from './useQueryData'
import { queryPedidos, queryPedidosPorEstatus, queryPedidosPorMes } from '../queries/pedidos'
import type { PedidoRow } from '../../types/domain'

export function usePedidosTable() {
  const soc = useUiStore((s) => s.selectedSociedad)
  return useQueryData<PedidoRow>(['pedidos', 'table', soc], queryPedidos(soc))
}

export function usePedidosPorEstatus() {
  const soc = useUiStore((s) => s.selectedSociedad)
  return useQueryData<{ nombre: string; total: number }>(
    ['pedidos', 'por-estatus', soc], queryPedidosPorEstatus(soc)
  )
}

export function usePedidosPorMes() {
  const soc = useUiStore((s) => s.selectedSociedad)
  return useQueryData<{ mes: string; total_pedidos: number; valor_total: number }>(
    ['pedidos', 'por-mes', soc], queryPedidosPorMes(soc)
  )
}

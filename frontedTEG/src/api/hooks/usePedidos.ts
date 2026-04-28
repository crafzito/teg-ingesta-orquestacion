import { useUiStore } from '../../stores/uiStore'
import { useQueryData } from './useQueryData'
import { queryPedidos, queryPedidosPorEstatus, queryPedidosPorMes } from '../queries/pedidos'
import type { PedidoRow } from '../../types/domain'

export function usePedidosTable() {
  const soc = useUiStore((s) => s.selectedSociedad)
  const periodo = useUiStore((s) => s.selectedPeriodo)
  return useQueryData<PedidoRow>(['pedidos', 'table', soc, periodo], queryPedidos({ soc, periodo }))
}

export function usePedidosPorEstatus() {
  const soc = useUiStore((s) => s.selectedSociedad)
  const periodo = useUiStore((s) => s.selectedPeriodo)
  return useQueryData<{ nombre: string; total: number }>(
    ['pedidos', 'por-estatus', soc, periodo], queryPedidosPorEstatus({ soc, periodo })
  )
}

export function usePedidosPorMes() {
  const soc = useUiStore((s) => s.selectedSociedad)
  const periodo = useUiStore((s) => s.selectedPeriodo)
  return useQueryData<{ mes: string; total_pedidos: number; valor_total: number }>(
    ['pedidos', 'por-mes', soc, periodo], queryPedidosPorMes({ soc, periodo })
  )
}

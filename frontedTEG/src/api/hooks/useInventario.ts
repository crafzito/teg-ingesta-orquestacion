import { useUiStore } from '../../stores/uiStore'
import { useQueryData } from './useQueryData'
import { queryInventario, queryInventarioPorCentro, queryInventarioTopMateriales } from '../queries/inventario'
import type { InventarioRow } from '../../types/domain'

export function useInventarioTable() {
  const soc = useUiStore((s) => s.selectedSociedad)
  return useQueryData<InventarioRow>(['inventario', 'table', soc], queryInventario(soc))
}

export function useInventarioPorCentro() {
  const soc = useUiStore((s) => s.selectedSociedad)
  return useQueryData<{ centro: string; stock: number; valor: number; materiales: number }>(
    ['inventario', 'por-centro', soc], queryInventarioPorCentro(soc)
  )
}

export function useInventarioTopMateriales() {
  const soc = useUiStore((s) => s.selectedSociedad)
  return useQueryData<{ material: string; nombre: string; stock: number; valor: number }>(
    ['inventario', 'top-materiales', soc], queryInventarioTopMateriales(soc)
  )
}

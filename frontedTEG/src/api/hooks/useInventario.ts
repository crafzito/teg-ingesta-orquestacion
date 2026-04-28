import { useUiStore } from '../../stores/uiStore'
import { useQueryData } from './useQueryData'
import { queryInventario, queryInventarioPorCentro, queryInventarioTopMateriales } from '../queries/inventario'
import type { InventarioRow } from '../../types/domain'

export function useInventarioTable() {
  const soc = useUiStore((s) => s.selectedSociedad)
  const centro = useUiStore((s) => s.selectedCentro)
  return useQueryData<InventarioRow>(['inventario', 'table', soc, centro], queryInventario({ soc, centro }))
}

export function useInventarioPorCentro() {
  const soc = useUiStore((s) => s.selectedSociedad)
  const centro = useUiStore((s) => s.selectedCentro)
  return useQueryData<{ centro: string; stock: number; valor: number; materiales: number }>(
    ['inventario', 'por-centro', soc, centro], queryInventarioPorCentro({ soc, centro })
  )
}

export function useInventarioTopMateriales() {
  const soc = useUiStore((s) => s.selectedSociedad)
  const centro = useUiStore((s) => s.selectedCentro)
  return useQueryData<{ material: string; nombre: string; stock: number; valor: number }>(
    ['inventario', 'top-materiales', soc, centro], queryInventarioTopMateriales({ soc, centro })
  )
}

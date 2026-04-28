import { useUiStore } from '../../stores/uiStore'
import { useQueryData } from './useQueryData'
import { queryProductos } from '../queries/productos'
import type { ProductoRow } from '../../types/domain'

export function useProductosTable() {
  const soc = useUiStore((s) => s.selectedSociedad)
  const centro = useUiStore((s) => s.selectedCentro)
  return useQueryData<ProductoRow>(['productos', 'table', soc, centro], queryProductos({ soc, centro }))
}

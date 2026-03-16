import { useUiStore } from '../../stores/uiStore'
import { useQueryData } from './useQueryData'
import { queryProductos } from '../queries/productos'
import type { ProductoRow } from '../../types/domain'

export function useProductosTable() {
  const soc = useUiStore((s) => s.selectedSociedad)
  return useQueryData<ProductoRow>(['productos', 'table', soc], queryProductos(soc))
}

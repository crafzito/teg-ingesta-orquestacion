import type { Sociedad } from '../../types/domain'
import { buildFilterClauses } from '../filters'

export interface InventarioFilter {
  soc: Sociedad
  centro: string
}

export function queryInventario(f: InventarioFilter, limit = 5000): string {
  const { andClauses } = buildFilterClauses({
    soc: f.soc, centro: f.centro, periodo: 'todo',
    sociedadCol: 'sociedad', centroCol: 'centro',
  })
  return `
    SELECT centro, almacen, codigo_mat, producto, tipo_inv,
           libre_ut, valor_libre, unidad
    FROM public.v_inventario
    WHERE 1=1${andClauses}
    ORDER BY valor_libre DESC
    LIMIT ${limit}
  `
}

export function queryInventarioPorCentro(f: InventarioFilter): string {
  const { andClauses } = buildFilterClauses({
    soc: f.soc, centro: f.centro, periodo: 'todo',
    sociedadCol: 'sociedad', centroCol: 'centro',
  })
  return `
    SELECT centro, SUM(libre_ut) as stock, SUM(valor_libre) as valor,
           COUNT(DISTINCT codigo_mat) as materiales
    FROM public.v_inventario
    WHERE 1=1${andClauses}
    GROUP BY centro ORDER BY valor DESC
  `
}

export function queryInventarioTopMateriales(f: InventarioFilter): string {
  const { andClauses } = buildFilterClauses({
    soc: f.soc, centro: f.centro, periodo: 'todo',
    sociedadCol: 'sociedad', centroCol: 'centro',
  })
  return `
    SELECT codigo_mat, COALESCE(producto, codigo_mat) as nombre,
           SUM(libre_ut) as stock, SUM(valor_libre) as valor
    FROM public.v_inventario
    WHERE 1=1${andClauses}
    GROUP BY codigo_mat, nombre ORDER BY valor DESC LIMIT 20
  `
}

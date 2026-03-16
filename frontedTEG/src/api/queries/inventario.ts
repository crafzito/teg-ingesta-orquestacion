import type { Sociedad } from '../../types/domain'

function centroFilter(soc: Sociedad): string {
  return soc ? ` AND centro::text LIKE '${soc}%'` : ''
}

export function queryInventario(soc: Sociedad, limit = 5000): string {
  return `
    SELECT centro, almacen, codigo_mat, producto, tipo_inv,
           libre_ut, valor_libre, unidad
    FROM public.v_inventario
    WHERE 1=1${centroFilter(soc)}
    ORDER BY valor_libre DESC
    LIMIT ${limit}
  `
}

export function queryInventarioPorCentro(soc: Sociedad): string {
  return `
    SELECT centro, SUM(libre_ut) as stock, SUM(valor_libre) as valor,
           COUNT(DISTINCT codigo_mat) as materiales
    FROM public.v_inventario
    WHERE 1=1${centroFilter(soc)}
    GROUP BY centro ORDER BY valor DESC
  `
}

export function queryInventarioTopMateriales(soc: Sociedad): string {
  return `
    SELECT codigo_mat, COALESCE(producto, codigo_mat) as nombre,
           SUM(libre_ut) as stock, SUM(valor_libre) as valor
    FROM public.v_inventario
    WHERE 1=1${centroFilter(soc)}
    GROUP BY codigo_mat, nombre ORDER BY valor DESC LIMIT 20
  `
}

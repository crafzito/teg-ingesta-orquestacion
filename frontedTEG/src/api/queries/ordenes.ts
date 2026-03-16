import type { Sociedad } from '../../types/domain'

function centroFilter(soc: Sociedad): string {
  return soc ? ` AND centro::text LIKE '${soc}%'` : ''
}

export function queryOrdenes(soc: Sociedad, limit = 5000): string {
  return `
    SELECT centro, num_orden, codigo_mat, producto, cantidad_orden, cantidad_recibida,
           estatus, fecha_ini_extrema::text, fecha_fin_extrema::text
    FROM public.v_ordenes
    WHERE 1=1${centroFilter(soc)}
    ORDER BY fecha_ini_extrema DESC
    LIMIT ${limit}
  `
}

export function queryOrdenesPorEstatus(soc: Sociedad): string {
  return `
    SELECT estatus, COUNT(*) as total
    FROM public.v_ordenes
    WHERE 1=1${centroFilter(soc)}
    GROUP BY estatus ORDER BY total DESC
  `
}

export function queryOrdenesPorCentro(soc: Sociedad): string {
  return `
    SELECT centro,
      SUM(CASE WHEN estatus = 'Abiertos' THEN 1 ELSE 0 END) as abiertas,
      SUM(CASE WHEN estatus = 'Liberados' THEN 1 ELSE 0 END) as liberadas,
      SUM(CASE WHEN estatus = 'Cerrado técnicamente' THEN 1 ELSE 0 END) as cerradas
    FROM public.v_ordenes
    WHERE 1=1${centroFilter(soc)}
    GROUP BY centro ORDER BY centro
  `
}

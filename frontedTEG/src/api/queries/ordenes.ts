import type { Sociedad } from '../../types/domain'
import type { PeriodoKey } from '../../stores/uiStore'
import { buildFilterClauses } from '../filters'

export interface OrdenesFilter {
  soc: Sociedad
  centro: string
  periodo: PeriodoKey
}

export function queryOrdenes(f: OrdenesFilter, limit = 5000): string {
  const { andClauses } = buildFilterClauses({
    soc: f.soc, centro: f.centro, periodo: f.periodo,
    sociedadCol: 'sociedad', centroCol: 'centro', fechaCol: 'fecha_ini_extrema',
  })
  return `
    SELECT centro, num_orden, codigo_mat, producto, cantidad_orden, cantidad_recibida,
           estatus, fecha_ini_extrema::text, fecha_fin_extrema::text
    FROM public.v_ordenes
    WHERE 1=1${andClauses}
    ORDER BY fecha_ini_extrema DESC
    LIMIT ${limit}
  `
}

export function queryOrdenesPorEstatus(f: OrdenesFilter): string {
  const { andClauses } = buildFilterClauses({
    soc: f.soc, centro: f.centro, periodo: f.periodo,
    sociedadCol: 'sociedad', centroCol: 'centro', fechaCol: 'fecha_ini_extrema',
  })
  return `
    SELECT estatus, COUNT(*) as total
    FROM public.v_ordenes
    WHERE 1=1${andClauses}
    GROUP BY estatus ORDER BY total DESC
  `
}

export function queryOrdenesPorCentro(f: OrdenesFilter): string {
  const { andClauses } = buildFilterClauses({
    soc: f.soc, centro: f.centro, periodo: f.periodo,
    sociedadCol: 'sociedad', centroCol: 'centro', fechaCol: 'fecha_ini_extrema',
  })
  return `
    SELECT centro,
      SUM(CASE WHEN estatus = 'Abiertos' THEN 1 ELSE 0 END) as abiertas,
      SUM(CASE WHEN estatus = 'Liberados' THEN 1 ELSE 0 END) as liberadas,
      SUM(CASE WHEN estatus = 'Cerrado técnicamente' THEN 1 ELSE 0 END) as cerradas
    FROM public.v_ordenes
    WHERE 1=1${andClauses}
    GROUP BY centro ORDER BY centro
  `
}

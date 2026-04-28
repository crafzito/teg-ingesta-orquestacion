import type { Sociedad } from '../types/domain'
import type { PeriodoKey } from '../stores/uiStore'

export interface FilterOpts {
  soc: Sociedad
  centro: string
  periodo: PeriodoKey
  fechaCol?: string
  sociedadCol?: string
  centroCol?: string
}

export interface BuiltFilter {
  whereClauses: string[]
  andClauses: string
  key: (string | number)[]
}

function periodoClause(periodo: PeriodoKey, fechaCol: string): string | null {
  switch (periodo) {
    case 'mes':
      return `${fechaCol} >= date_trunc('month', CURRENT_DATE)`
    case 'trimestre':
      return `${fechaCol} >= date_trunc('quarter', CURRENT_DATE)`
    case 'ano':
      return `${fechaCol} >= date_trunc('year', CURRENT_DATE)`
    case 'todo':
    default:
      return null
  }
}

export function buildFilterClauses(opts: FilterOpts): BuiltFilter {
  const { soc, centro, periodo, fechaCol, sociedadCol, centroCol } = opts
  const where: string[] = []

  if (soc && sociedadCol) {
    where.push(`${sociedadCol} = '${soc}'`)
  }
  if (centro && centroCol) {
    where.push(`${centroCol} = '${centro}'`)
  }
  if (fechaCol) {
    const p = periodoClause(periodo, fechaCol)
    if (p) where.push(p)
  }

  const and = where.length ? ' AND ' + where.join(' AND ') : ''
  return {
    whereClauses: where,
    andClauses: and,
    key: [soc || 'all', centro || 'all', fechaCol ? periodo : 'na'],
  }
}

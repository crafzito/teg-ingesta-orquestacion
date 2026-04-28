import type { Sociedad } from '../../types/domain'
import type { PeriodoKey } from '../../stores/uiStore'
import { buildFilterClauses } from '../filters'

export interface CxcFilter {
  soc: Sociedad
  periodo: PeriodoKey
}

export function queryCxc(f: CxcFilter, limit = 5000): string {
  const { andClauses } = buildFilterClauses({
    soc: f.soc, centro: '', periodo: f.periodo,
    sociedadCol: 'sociedad', fechaCol: 'fecha_doc',
  })
  return `
    SELECT sociedad, cod_cliente, nombre_cliente, n_documento, fecha_doc::text,
           fecha_venc::text, valor_monetario, cod_moneda, d_venc, total_vencido
    FROM public.v_cxc
    WHERE 1=1${andClauses}
    ORDER BY d_venc DESC
    LIMIT ${limit}
  `
}

export function queryCxcAging(f: CxcFilter): string {
  const { andClauses } = buildFilterClauses({
    soc: f.soc, centro: '', periodo: f.periodo,
    sociedadCol: 'sociedad', fechaCol: 'fecha_doc',
  })
  return `
    SELECT 'No vencido' as bucket, COALESCE(SUM(no_vencido), 0) as total, COUNT(CASE WHEN no_vencido != 0 THEN 1 END) as count FROM public.v_cxc WHERE 1=1${andClauses}
    UNION ALL
    SELECT '1-15 dias', COALESCE(SUM(venc_1_15), 0), COUNT(CASE WHEN venc_1_15 != 0 THEN 1 END) FROM public.v_cxc WHERE 1=1${andClauses}
    UNION ALL
    SELECT '16-30 dias', COALESCE(SUM(venc_16_30), 0), COUNT(CASE WHEN venc_16_30 != 0 THEN 1 END) FROM public.v_cxc WHERE 1=1${andClauses}
    UNION ALL
    SELECT '31-60 dias', COALESCE(SUM(venc_31_60), 0), COUNT(CASE WHEN venc_31_60 != 0 THEN 1 END) FROM public.v_cxc WHERE 1=1${andClauses}
    UNION ALL
    SELECT '61-90 dias', COALESCE(SUM(venc_61_90), 0), COUNT(CASE WHEN venc_61_90 != 0 THEN 1 END) FROM public.v_cxc WHERE 1=1${andClauses}
    UNION ALL
    SELECT '91+ dias', COALESCE(SUM(venc_91_mas), 0), COUNT(CASE WHEN venc_91_mas != 0 THEN 1 END) FROM public.v_cxc WHERE 1=1${andClauses}
  `
}

export function queryCxcPorCliente(f: CxcFilter): string {
  const { andClauses } = buildFilterClauses({
    soc: f.soc, centro: '', periodo: f.periodo,
    sociedadCol: 'sociedad', fechaCol: 'fecha_doc',
  })
  return `
    SELECT COALESCE(nombre_cliente, cod_cliente) as nombre,
           SUM(valor_monetario) as total, SUM(total_vencido) as vencido, COUNT(*) as docs
    FROM public.v_cxc
    WHERE 1=1${andClauses}
    GROUP BY nombre ORDER BY total DESC LIMIT 20
  `
}

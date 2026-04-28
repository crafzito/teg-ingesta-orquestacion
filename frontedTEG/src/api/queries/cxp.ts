import type { Sociedad } from '../../types/domain'
import type { PeriodoKey } from '../../stores/uiStore'
import { buildFilterClauses } from '../filters'

export interface CxpFilter {
  soc: Sociedad
  periodo: PeriodoKey
}

export function queryCxp(f: CxpFilter, limit = 5000): string {
  const { andClauses } = buildFilterClauses({
    soc: f.soc, centro: '', periodo: f.periodo,
    sociedadCol: 'sociedad', fechaCol: 'fecha_doc',
  })
  return `
    SELECT sociedad, proveedor, nombre_proveedor, n_documento, fecha_doc::text,
           fecha_venc::text, importe, cod_moneda, d_venc
    FROM public.v_cxp
    WHERE 1=1${andClauses}
    ORDER BY d_venc DESC
    LIMIT ${limit}
  `
}

export function queryCxpAging(f: CxpFilter): string {
  const { andClauses } = buildFilterClauses({
    soc: f.soc, centro: '', periodo: f.periodo,
    sociedadCol: 'sociedad', fechaCol: 'fecha_doc',
  })
  return `
    SELECT 'Por vencer' as bucket, COALESCE(SUM(por_vencer), 0) as total, COUNT(CASE WHEN por_vencer != 0 THEN 1 END) as count FROM public.v_cxp WHERE 1=1${andClauses}
    UNION ALL
    SELECT '1-30 dias', COALESCE(SUM(venc_1_30), 0), COUNT(CASE WHEN venc_1_30 != 0 THEN 1 END) FROM public.v_cxp WHERE 1=1${andClauses}
    UNION ALL
    SELECT '31-60 dias', COALESCE(SUM(venc_31_60), 0), COUNT(CASE WHEN venc_31_60 != 0 THEN 1 END) FROM public.v_cxp WHERE 1=1${andClauses}
    UNION ALL
    SELECT '61-90 dias', COALESCE(SUM(venc_61_90), 0), COUNT(CASE WHEN venc_61_90 != 0 THEN 1 END) FROM public.v_cxp WHERE 1=1${andClauses}
    UNION ALL
    SELECT '91+ dias', COALESCE(SUM(venc_91_mas), 0), COUNT(CASE WHEN venc_91_mas != 0 THEN 1 END) FROM public.v_cxp WHERE 1=1${andClauses}
  `
}

export function queryCxpPorProveedor(f: CxpFilter): string {
  const { andClauses } = buildFilterClauses({
    soc: f.soc, centro: '', periodo: f.periodo,
    sociedadCol: 'sociedad', fechaCol: 'fecha_doc',
  })
  return `
    SELECT COALESCE(nombre_proveedor, proveedor) as nombre,
           SUM(importe) as total, COUNT(*) as docs
    FROM public.v_cxp
    WHERE 1=1${andClauses}
    GROUP BY nombre ORDER BY total DESC LIMIT 20
  `
}

import type { Sociedad } from '../../types/domain'

function pedidosSocFilter(soc: Sociedad): string {
  if (!soc) return ''
  return ` AND sociedad = '${soc}'`
}

export function withScopedPedidos(selectSql: string, soc: Sociedad): string {
  return `
    WITH ventas_material_sociedad AS (
      SELECT
        codigo_mat,
        MIN(org_vtas) AS sociedad
      FROM fact.ventas
      WHERE NULLIF(BTRIM(COALESCE(org_vtas::text, '')), '') IS NOT NULL
      GROUP BY codigo_mat
      HAVING COUNT(DISTINCT org_vtas) = 1
    ),
    ventas_cliente_sociedad AS (
      SELECT
        cod_cliente,
        MIN(org_vtas) AS sociedad
      FROM fact.ventas
      WHERE NULLIF(BTRIM(COALESCE(org_vtas::text, '')), '') IS NOT NULL
      GROUP BY cod_cliente
      HAVING COUNT(DISTINCT org_vtas) = 1
    ),
    pedidos_base AS (
      SELECT
        p.*,
        CASE
          WHEN vcs.sociedad IS NOT NULL AND vms.sociedad IS NOT NULL AND vcs.sociedad <> vms.sociedad THEN vcs.sociedad
          ELSE COALESCE(vcs.sociedad, vms.sociedad)
        END AS sociedad_resuelta
      FROM public.v_pedidos p
      LEFT JOIN ventas_material_sociedad vms ON p.codigo_mat = vms.codigo_mat
      LEFT JOIN ventas_cliente_sociedad vcs ON p.cod_cliente = vcs.cod_cliente
    ),
    pedidos_resolution_stats AS (
      SELECT
        COUNT(DISTINCT sociedad_resuelta) FILTER (WHERE sociedad_resuelta IS NOT NULL) AS distinct_sociedades,
        MIN(sociedad_resuelta) FILTER (WHERE sociedad_resuelta IS NOT NULL) AS sociedad_unica
      FROM pedidos_base
    ),
    pedidos_scoped AS (
      SELECT
        p.*,
        COALESCE(
          p.sociedad_resuelta,
          CASE
            WHEN prs.distinct_sociedades = 1 THEN prs.sociedad_unica
            ELSE NULL
          END
        ) AS sociedad
      FROM pedidos_base p
      CROSS JOIN pedidos_resolution_stats prs
    )
    ${selectSql.replace('__SOC_FILTER__', pedidosSocFilter(soc))}
  `
}

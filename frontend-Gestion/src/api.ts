import type {
  LookerView,
  BaseView,
  ViewColumn,
  CreateViewRequest,
  QueryResponse,
  ExportResponse,
  ExportFilter,
  EtlMonitorResponse,
  EtlRunRequest,
  EtlRunResponse,
} from './types'
import { getBackendHttpOrigin } from './config'

const BASE = '/api'

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error((body as { detail?: string }).detail ?? res.statusText)
  }
  return res.json() as Promise<T>
}

export async function checkHealth(): Promise<{ status: string }> {
  const res = await fetch(`${BASE}/health`)
  return handleResponse(res)
}

export async function getEtlMonitor(): Promise<EtlMonitorResponse> {
  const res = await fetch(`${BASE}/etl/monitor`)
  return handleResponse(res)
}

export async function runEtl(params: EtlRunRequest = {}): Promise<EtlRunResponse> {
  const res = await fetch(`${BASE}/etl/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  return handleResponse(res)
}

export async function getLookerViews(): Promise<LookerView[]> {
  const res = await fetch(`${BASE}/looker/views`)
  return handleResponse(res)
}

export async function getBaseViews(): Promise<BaseView[]> {
  const res = await fetch(`${BASE}/looker/base-views`)
  return handleResponse(res)
}

export async function getViewColumns(viewName: string): Promise<ViewColumn[]> {
  const res = await fetch(`${BASE}/looker/views/${encodeURIComponent(viewName)}/columns`)
  return handleResponse(res)
}

export async function getAnyTableColumns(
  schema: string,
  tableName: string,
): Promise<ViewColumn[]> {
  if (schema === 'public' || schema === 'reporting') {
    return getViewColumns(tableName)
  }
  const res = await fetch(
    `${BASE}/schema/columns?schemas=${encodeURIComponent(schema)}&table_name=${encodeURIComponent(tableName)}`,
  )
  const cols = await handleResponse<{ column_name: string; data_type: string }[]>(res)
  return cols.map((c) => ({ column_name: c.column_name, data_type: c.data_type }))
}

export async function createLookerView(
  data: CreateViewRequest,
): Promise<{ name: string; sql: string }> {
  const res = await fetch(`${BASE}/looker/views`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse(res)
}

export async function deleteLookerView(name: string): Promise<{ deleted: string }> {
  const res = await fetch(`${BASE}/looker/views/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  })
  return handleResponse(res)
}

export async function executeQuery(sql: string, limit = 1000): Promise<QueryResponse> {
  const res = await fetch(`${BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, limit }),
  })
  return handleResponse(res)
}

export interface ExportParams {
  schema?: string
  limit?: number
  offset?: number
  filters?: ExportFilter[]
}

/**
 * Construye la URL del endpoint de exportación.
 * @param absolute  true → URL absoluta con host (para mostrar al usuario / curl)
 */
export function buildExportUrl(
  viewName: string,
  params: ExportParams,
  absolute = false,
): string {
  const { schema = 'public', limit = 500, offset = 0, filters = [] } = params
  const sp = new URLSearchParams()
  sp.set('schema', schema)
  sp.set('limit', String(limit))
  if (offset > 0) sp.set('offset', String(offset))
  for (const f of filters) {
    if (f.column && f.operator && f.value.trim()) {
      sp.append('filter', `${f.column}:${f.operator}:${f.value}`)
    }
  }
  const path = `${BASE}/export/${encodeURIComponent(viewName)}?${sp.toString()}`
  return absolute ? `${getBackendHttpOrigin()}${path}` : path
}

export async function exportView(
  viewName: string,
  params: ExportParams = {},
): Promise<ExportResponse> {
  const url = buildExportUrl(viewName, params)
  const res = await fetch(url)
  return handleResponse<ExportResponse>(res)
}

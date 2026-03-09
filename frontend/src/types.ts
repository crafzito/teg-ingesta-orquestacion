export type Page = 'dashboard' | 'views' | 'guide' | 'sql' | 'export'

export interface LookerView {
  name: string
  view_definition: string
  is_custom: boolean
  category: string
  description: string
}

export interface BaseView {
  schema_name: string
  view_name: string
  full_name: string
  label: string
}

export interface ViewFilter {
  column: string
  operator: string
  value: string
}

export interface CreateViewRequest {
  name: string
  base_view: string
  description: string
  filters: ViewFilter[]
}

export interface ViewColumn {
  column_name: string
  data_type: string
}

export interface HealthStatus {
  status: 'ok' | 'error'
}

export interface ExportFilter {
  column: string
  operator: string
  value: string
}

export interface ExportResponse {
  view: string
  schema: string
  total_records: number
  returned_records: number
  truncated: boolean
  offset: number
  limit: number
  filters_applied: ExportFilter[]
  execution_time_ms: number
  data: Record<string, unknown>[]
}

export interface QueryResponse {
  columns: string[]
  rows: unknown[][]
  row_count: number
  execution_time_ms: number
  truncated: boolean
}

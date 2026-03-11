export type Page = 'dashboard' | 'etl' | 'views' | 'guide' | 'sql' | 'export'

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

export interface EtlFileEntry {
  name: string
  extension: string
  size_bytes: number
  modified_at: string | null
}

export interface EtlDirectorySummary {
  name: string
  path: string
  exists: boolean
  total_files: number
  csv_files: number
  xlsx_files: number
  latest_file_at: string | null
  files: EtlFileEntry[]
}

export interface EtlExecutionItem {
  id: number
  source_key: string
  filepath: string
  status: string
  started_at: string | null
  finished_at: string | null
  rows_read: number
  rows_inserted: number
  rows_updated: number
  rows_skipped: number
  rows_rejected: number
  error_message: string | null
}

export interface EtlSourceStatus {
  archivo: string
  estado: string
  ultima_carga: string | null
  leidas: number
  nuevas: number
  actualizadas: number
  sin_cambios: number
  rechazadas: number
  pct_sin_cambios: string
  error: string | null
}

export interface EtlMonitorSummary {
  monitored_directories: number
  total_files: number
  csv_files: number
  xlsx_files: number
  latest_modified_file_at: string | null
  running_count: number
  successful_executions: number
  failed_executions: number
  last_started_at: string | null
  last_finished_at: string | null
  last_success_at: string | null
  last_failure_at: string | null
  total_sources: number
  sources_ok: number
  sources_failed: number
  sources_running: number
}

export interface EtlMonitorResponse {
  generated_at: string
  database_available: boolean
  database_error: string | null
  summary: EtlMonitorSummary
  current_runs: EtlExecutionItem[]
  latest_execution: EtlExecutionItem | null
  recent_executions: EtlExecutionItem[]
  source_status: EtlSourceStatus[]
  directories: EtlDirectorySummary[]
}

// Mirrors backend GET /api/etl/monitor response.

export interface EtlBatchFileItem {
  id: number
  batch_id: string
  source_key: string | null
  filename: string
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

export interface EtlBatchItem {
  batch_id: string
  trigger_type: string
  scope: string
  status: string
  data_dir: string | null
  started_at: string | null
  heartbeat_at: string | null
  finished_at: string | null
  file_count: number
  source_count: number
  files_received: number
  files_processing: number
  files_success: number
  files_failed: number
  rows_read_total: number
  rows_inserted_total: number
  rows_updated_total: number
  rows_rejected_total: number
  error_message: string | null
  files: EtlBatchFileItem[]
}

export interface EtlExecutionItem {
  id: number
  batch_id: string | null
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
  running_batches: number
  successful_batches: number
  failed_batches: number
  last_batch_id: string | null
  last_batch_status: string | null
  batch_id: string | null
  batch_rows_total: number
}

export interface EtlDirectorySummary {
  name: string
  path: string
  exists: boolean
  total_files: number
  csv_files: number
  xlsx_files: number
  latest_file_at: string | null
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
  current_batches: EtlBatchItem[]
  recent_batches: EtlBatchItem[]
  directories: EtlDirectorySummary[]
}

export interface EtlRunRequest {
  data_dir?: string
  source?: string
  dry_run?: boolean
  skip_raw?: boolean
}

export interface EtlRunResponse {
  status: string
  message: string
  pid: number | null
  data_dir: string | null
}

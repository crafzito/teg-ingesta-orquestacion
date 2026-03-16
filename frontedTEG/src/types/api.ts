export interface QueryRequest {
  sql: string
  limit?: number
}

export interface QueryResponse {
  columns: string[]
  rows: (string | number | null)[][]
  row_count: number
  execution_time_ms: number
  truncated: boolean
}

export interface ApiError {
  detail: string
}

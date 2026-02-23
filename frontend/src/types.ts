export interface QueryResponse {
  columns: string[];
  rows: (string | number | boolean | null)[][];
  row_count: number;
  execution_time_ms: number;
  truncated: boolean;
}

export interface SchemaTable {
  schema_name: string;
  table_name: string;
  table_type: "table" | "view";
}

export interface ApiError {
  detail: string;
}

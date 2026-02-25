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

export interface SchemaColumn {
  schema_name: string;
  table_name: string;
  column_name: string;
  ordinal_position: number;
  data_type: string;
  is_nullable: boolean;
  column_default: string | null;
  is_primary_key: boolean;
}

export interface SchemaRelation {
  constraint_name: string;
  source_schema: string;
  source_table: string;
  source_column: string;
  target_schema: string;
  target_table: string;
  target_column: string;
}

export interface LineageSource {
  source_key: string;
  file_name: string;
  target_schema: string;
  target_table: string;
  role: string;
  pk_cols: string[];
  upsert_mode: string;
}

export interface LogicalRelation {
  source_key: string;
  source_column: string;
  target_table: string;
  target_column: string;
  confidence: string;
  evidence: string;
}

export interface InputFilesResponse {
  total_files: number;
  all_files: string[];
  csv_count: number;
  csv_files: string[];
  non_csv_count: number;
  non_csv_files: string[];
}

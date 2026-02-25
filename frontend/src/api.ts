import type {
  QueryResponse,
  SchemaTable,
  ApiError,
  SchemaColumn,
  SchemaRelation,
  LineageSource,
  LogicalRelation,
  InputFilesResponse,
} from "./types";

function buildApiUrl(path: string, baseUrl?: string): string {
  const normalizedBase = (baseUrl ?? "").trim().replace(/\/+$/, "");
  return normalizedBase ? `${normalizedBase}${path}` : path;
}

export async function executeQuery(
  sql: string,
  limit = 1000,
  baseUrl?: string
): Promise<QueryResponse> {
  const res = await fetch(buildApiUrl("/api/query", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql, limit }),
  });
  if (!res.ok) {
    const err: ApiError = await res.json();
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchSchema(baseUrl?: string): Promise<SchemaTable[]> {
  const res = await fetch(buildApiUrl("/api/schema", baseUrl));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchSchemaColumns(
  schemas = "cat,dim,fact,raw,etl",
  tableName?: string,
  baseUrl?: string
): Promise<SchemaColumn[]> {
  const params = new URLSearchParams({ schemas });
  if (tableName) params.set("table_name", tableName);
  const res = await fetch(buildApiUrl(`/api/schema/columns?${params.toString()}`, baseUrl));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchSchemaRelations(
  schemas = "cat,dim,fact,raw,etl",
  baseUrl?: string
): Promise<SchemaRelation[]> {
  const params = new URLSearchParams({ schemas });
  const res = await fetch(buildApiUrl(`/api/schema/relations?${params.toString()}`, baseUrl));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchLineageSources(baseUrl?: string): Promise<LineageSource[]> {
  const res = await fetch(buildApiUrl("/api/lineage/sources", baseUrl));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchLogicalRelations(baseUrl?: string): Promise<LogicalRelation[]> {
  const res = await fetch(buildApiUrl("/api/lineage/relations", baseUrl));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchInputFiles(baseUrl?: string): Promise<InputFilesResponse> {
  const res = await fetch(buildApiUrl("/api/lineage/input-files", baseUrl));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

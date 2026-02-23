import type { QueryResponse, SchemaTable, ApiError } from "./types";

export async function executeQuery(
  sql: string,
  limit = 1000
): Promise<QueryResponse> {
  const res = await fetch("/api/query", {
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

export async function fetchSchema(): Promise<SchemaTable[]> {
  const res = await fetch("/api/schema");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

import { API_BASE, DEFAULT_QUERY_LIMIT } from '../config/env'
import type { QueryRequest, QueryResponse } from '../types/api'

class ApiClient {
  private baseUrl = API_BASE

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const token = localStorage.getItem('teg_auth_token')
    if (token) headers['Authorization'] = `Bearer ${token}`
    return headers
  }

  async query(sql: string, limit = DEFAULT_QUERY_LIMIT): Promise<QueryResponse> {
    const body: QueryRequest = { sql, limit }
    const res = await fetch(`${this.baseUrl}/query`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail || `HTTP ${res.status}`)
    }
    return res.json()
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`)
      return res.ok
    } catch {
      return false
    }
  }
}

export const apiClient = new ApiClient()

export function rowsToObjects<T>(columns: string[], rows: (string | number | null)[][]): T[] {
  return rows.map((row) => {
    const obj: Record<string, unknown> = {}
    columns.forEach((col, i) => {
      obj[col] = row[i]
    })
    return obj as T
  })
}

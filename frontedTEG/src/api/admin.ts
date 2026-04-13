import { API_BASE } from '../config/env'
import type { AdminOverview } from '../types/admin'

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = localStorage.getItem('teg_auth_token')
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const res = await fetch(`${API_BASE}/admin/summary`, {
    headers: buildHeaders(),
  })
  return readJson<AdminOverview>(res)
}

export async function refreshSchemaCache(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/schema/refresh`, {
    method: 'POST',
    headers: buildHeaders(),
  })
  return readJson<{ status: string }>(res)
}

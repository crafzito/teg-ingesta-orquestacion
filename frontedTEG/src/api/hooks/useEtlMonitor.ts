import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { API_BASE } from '../../config/env'
import type { EtlMonitorResponse, EtlRunRequest, EtlRunResponse } from '../../types/etl'

const ETL_MONITOR_KEY = ['etl', 'monitor']

async function fetchEtlMonitor(): Promise<EtlMonitorResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = localStorage.getItem('teg_auth_token')
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}/etl/monitor`, { headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

async function postEtlRun(body: EtlRunRequest = {}): Promise<EtlRunResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = localStorage.getItem('teg_auth_token')
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}/etl/run`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export function useEtlMonitor() {
  return useQuery({
    queryKey: ETL_MONITOR_KEY,
    queryFn: fetchEtlMonitor,
  })
}

export function useEtlRun() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body?: EtlRunRequest) => postEtlRun(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ETL_MONITOR_KEY })
    },
  })
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { API_BASE } from '../../config/env'
import type { EtlMonitorResponse, EtlRunRequest, EtlRunResponse } from '../../types/etl'

const ETL_MONITOR_KEY = ['etl', 'monitor']
const POLL_ACTIVE = 5_000  // 5s when batches are running
const POLL_IDLE = 30_000   // 30s otherwise

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
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return POLL_IDLE
      const hasRunning = (data.current_batches?.length ?? 0) > 0
        || (data.summary?.running_batches ?? 0) > 0
      return hasRunning ? POLL_ACTIVE : POLL_IDLE
    },
  })
}

export function useEtlRun() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body?: EtlRunRequest) => postEtlRun(body),
    onSuccess: () => {
      // Invalidate to trigger immediate refetch
      queryClient.invalidateQueries({ queryKey: ETL_MONITOR_KEY })
    },
  })
}

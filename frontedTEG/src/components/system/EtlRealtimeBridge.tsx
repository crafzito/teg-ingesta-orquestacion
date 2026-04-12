import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { API_BASE } from '../../config/env'
import { useAuthStore } from '../../stores/authStore'
import type { EtlMonitorResponse } from '../../types/etl'

const ETL_MONITOR_KEY = ['etl', 'monitor']
const RECONNECT_MS = 3000
const REFRESHABLE_PREFIXES = new Set([
  'kpi',
  'chart',
  'ventas',
  'cxc',
  'cxp',
  'inventario',
  'ordenes',
  'pedidos',
  'clientes',
  'productos',
])

function buildWsUrl(token: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const base = `${protocol}://${window.location.host}${API_BASE}/etl/ws/monitor`
  return `${base}?access_token=${encodeURIComponent(token)}`
}

function shouldInvalidate(previous: EtlMonitorResponse | undefined, next: EtlMonitorResponse): boolean {
  if (!previous) return false

  const previousRunning = (previous.summary?.running_batches ?? 0) > 0
  const nextRunning = (next.summary?.running_batches ?? 0) > 0
  const finished = previousRunning && !nextRunning
  const batchChanged = previous.summary?.last_batch_id !== next.summary?.last_batch_id
  const finishedAtChanged = previous.summary?.last_finished_at !== next.summary?.last_finished_at
  const status = next.summary?.last_batch_status

  return (finished || batchChanged || finishedAtChanged) && status !== 'RUNNING' && status !== null
}

function invalidateAnalyticsQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({
    predicate: (query) => {
      const prefix = query.queryKey[0]
      return typeof prefix === 'string' && REFRESHABLE_PREFIXES.has(prefix)
    },
  })
}

export function EtlRealtimeBridge() {
  const queryClient = useQueryClient()
  const token = useAuthStore((s) => s.token)
  const userRole = useAuthStore((s) => s.user?.role)
  const initialized = useAuthStore((s) => s.initialized)
  const reconnectRef = useRef<number | null>(null)

  useEffect(() => {
    if (!initialized || !token || (userRole !== 'admin' && userRole !== 'superadmin')) {
      return undefined
    }

    let active = true
    let socket: WebSocket | null = null

    const connect = () => {
      if (!active) return
      socket = new WebSocket(buildWsUrl(token))

      socket.onmessage = (event) => {
        const next = JSON.parse(event.data) as EtlMonitorResponse
        const previous = queryClient.getQueryData<EtlMonitorResponse>(ETL_MONITOR_KEY)
        queryClient.setQueryData(ETL_MONITOR_KEY, next)
        if (shouldInvalidate(previous, next)) {
          invalidateAnalyticsQueries(queryClient)
        }
      }

      socket.onclose = () => {
        if (!active) return
        reconnectRef.current = window.setTimeout(connect, RECONNECT_MS)
      }

      socket.onerror = () => {
        socket?.close()
      }
    }

    connect()

    return () => {
      active = false
      if (reconnectRef.current) {
        window.clearTimeout(reconnectRef.current)
      }
      socket?.close()
    }
  }, [initialized, queryClient, token, userRole])

  return null
}

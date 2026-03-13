import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  PlayCircle,
  RefreshCw,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react'
import { getEtlMonitor, runEtl } from '../api'
import { getBackendWsOrigin } from '../config'
import type {
  EtlBatchFileItem,
  EtlBatchItem,
  EtlMonitorResponse,
} from '../types'

const POLL_MS = 15_000
const RECENT_FILES_LIMIT = 8

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return value
  return new Date(parsed).toLocaleString('es-VE', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-VE').format(value)
}

function statusTone(status: string): string {
  if (status === 'SUCCESS') return 'bg-emerald-100 text-emerald-700'
  if (status === 'FAILED' || status === 'PARTIAL_FAILED') return 'bg-red-100 text-red-700'
  if (status === 'RUNNING' || status === 'PROCESSING') return 'bg-amber-100 text-amber-700'
  if (status === 'SKIPPED' || status === 'IGNORED') return 'bg-slate-100 text-slate-600'
  if (status === 'RECEIVED') return 'bg-blue-100 text-blue-700'
  return 'bg-slate-100 text-slate-600'
}

function statusLabel(status: string): string {
  if (status === 'SUCCESS') return 'Cargado'
  if (status === 'FAILED') return 'Falló'
  if (status === 'PARTIAL_FAILED') return 'Parcial'
  if (status === 'RUNNING' || status === 'PROCESSING') return 'En proceso'
  if (status === 'RECEIVED') return 'Recibido'
  if (status === 'SKIPPED') return 'Sin cambios'
  if (status === 'IGNORED') return 'Ignorado'
  return status
}

function shortBatchId(batchId: string | null | undefined): string {
  if (!batchId) return '—'
  return batchId.length > 18 ? batchId.slice(-18) : batchId
}

function sumActiveFiles(batch: EtlBatchItem): number {
  return batch.files_processing + batch.files_received
}

export default function EtlMonitorPage() {
  const [data, setData] = useState<EtlMonitorResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const [etlLaunching, setEtlLaunching] = useState(false)
  const [etlMsg, setEtlMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const pollRef = useRef<number | null>(null)

  const load = useCallback(async (background = false) => {
    if (background) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setError(null)

    try {
      const next = await getEtlMonitor()
      setData(next)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    function startPolling() {
      if (pollRef.current) return
      pollRef.current = window.setInterval(() => {
        void load(true)
      }, POLL_MS)
    }

    function connectWs() {
      const ws = new WebSocket(`${getBackendWsOrigin()}/api/etl/ws/monitor`)
      wsRef.current = ws

      ws.onopen = () => {
        if (!mounted) return
        setWsConnected(true)
        if (pollRef.current) {
          window.clearInterval(pollRef.current)
          pollRef.current = null
        }
      }

      ws.onmessage = (event) => {
        if (!mounted) return
        try {
          const parsed = JSON.parse(event.data as string) as EtlMonitorResponse
          setData(parsed)
          setLoading(false)
        } catch {
          // ignore malformed payloads
        }
      }

      ws.onclose = () => {
        if (!mounted) return
        setWsConnected(false)
        wsRef.current = null
        startPolling()
        window.setTimeout(() => {
          if (mounted && !wsRef.current) {
            connectWs()
          }
        }, 5_000)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    void load()
    connectWs()

    return () => {
      mounted = false
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      if (pollRef.current) {
        window.clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [load])

  const handleRunEtl = useCallback(async () => {
    setEtlLaunching(true)
    setEtlMsg(null)
    try {
      const res = await runEtl()
      setEtlMsg({
        type: res.status === 'started' ? 'ok' : 'err',
        text: res.message,
      })
    } catch (e) {
      setEtlMsg({ type: 'err', text: (e as Error).message })
    } finally {
      setEtlLaunching(false)
    }
  }, [])

  const summary = data?.summary
  const currentBatches = data?.current_batches ?? []
  const recentBatches = data?.recent_batches ?? []
  const activeBatch = currentBatches[0] ?? null
  const lastBatch = activeBatch ?? recentBatches[0] ?? null
  const batchRunning = currentBatches.length > 0
  const hasBatchFailures = (summary?.failed_batches ?? 0) > 0

  return (
    <div className="w-full space-y-6">
      <section className="card overflow-hidden border-0 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 text-white">
        <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Activity size={16} />
              Monitor ETL por lotes
            </div>
            <h2 className="mt-2 text-2xl font-semibold">
              Auditoría clara por lote y por archivo
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              El watcher agrupa archivos en lotes. Aquí ves el lote activo, los
              archivos que lo componen y el histórico reciente con fecha, hora y
              resultado.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => void handleRunEtl()}
              disabled={etlLaunching || batchRunning}
              className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <PlayCircle size={15} className={batchRunning ? 'animate-pulse' : ''} />
              {etlLaunching ? 'Iniciando…' : batchRunning ? 'Lote en proceso' : 'Ejecutar ETL'}
            </button>

            <button onClick={() => void load(true)} className="btn-secondary">
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Actualizar
            </button>

            <div
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs ${
                wsConnected
                  ? 'bg-emerald-500/20 text-emerald-200'
                  : 'bg-white/10 text-slate-300'
              }`}
            >
              {wsConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {wsConnected ? 'Tiempo real' : `Polling ${POLL_MS / 1000}s`}
            </div>
          </div>
        </div>

        <div className="grid gap-px bg-white/10 md:grid-cols-4">
          <HeroMetric
            icon={
              batchRunning ? <LoaderCircle size={18} className="animate-spin" /> : <CheckCircle2 size={18} />
            }
            label="Estado actual"
            value={
              loading
                ? 'Cargando…'
                : batchRunning
                  ? 'Procesando lote'
                  : hasBatchFailures
                    ? 'Con fallos'
                    : 'En espera'
            }
            hint={data ? `Actualizado: ${formatDateTime(data.generated_at)}` : 'Sin datos'}
          />
          <HeroMetric
            icon={<Clock3 size={18} />}
            label="Último lote"
            value={lastBatch ? shortBatchId(lastBatch.batch_id) : '—'}
            hint={lastBatch ? formatDateTime(lastBatch.started_at) : 'Sin lotes registrados'}
          />
          <HeroMetric
            icon={<CheckCircle2 size={18} />}
            label="Lotes OK"
            value={summary ? formatNumber(summary.successful_batches) : '—'}
            hint={summary ? `${formatNumber(summary.running_batches)} activos` : 'Sin datos'}
          />
          <HeroMetric
            icon={hasBatchFailures ? <AlertCircle size={18} /> : <XCircle size={18} />}
            label="Lotes con error"
            value={summary ? formatNumber(summary.failed_batches) : '—'}
            hint={lastBatch ? statusLabel(lastBatch.status) : 'Sin datos'}
          />
        </div>
      </section>

      {etlMsg && (
        <div
          className={`card flex items-center justify-between p-4 text-sm ${
            etlMsg.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-amber-200 bg-amber-50 text-amber-700'
          }`}
        >
          <span>{etlMsg.text}</span>
          <button
            onClick={() => setEtlMsg(null)}
            className="text-xs underline opacity-70 hover:opacity-100"
          >
            Cerrar
          </button>
        </div>
      )}

      {error && (
        <div className="card border-red-200 bg-red-50 p-4 text-sm text-red-700">
          No se pudo cargar el monitor del ETL: {error}
        </div>
      )}

      {data && !data.database_available && (
        <div className="card border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          La base de datos no respondió para las métricas del ETL.
          {data.database_error ? ` Detalle: ${data.database_error}` : ''}
        </div>
      )}

      <section className="card p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Lote en proceso</h3>
            <p className="mt-1 text-sm text-slate-500">
              Cuando SAP deja archivos en la carpeta, el watcher los agrupa en un lote.
              Aquí ves el lote abierto y el avance de cada archivo.
            </p>
          </div>
          <span
            className={`badge ${
              batchRunning ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {batchRunning ? `${currentBatches.length} lote(s) activo(s)` : 'Sin lotes activos'}
          </span>
        </div>

        {currentBatches.length > 0 ? (
          <div className="mt-5 space-y-4">
            {currentBatches.map((batch) => (
              <BatchPanel key={batch.batch_id} batch={batch} emphasize />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-500">
            No hay lotes activos en este momento.
          </div>
        )}
      </section>

      <section className="card p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Últimos lotes</h3>
            <p className="mt-1 text-sm text-slate-500">
              Histórico reciente, ordenado del lote más nuevo al más viejo.
            </p>
          </div>
          <span className="text-xs text-slate-400">
            {recentBatches.length > 0 ? `${recentBatches.length} lotes` : 'Sin histórico'}
          </span>
        </div>

        {recentBatches.length > 0 ? (
          <div className="mt-5 space-y-4">
            {recentBatches.map((batch) => (
              <BatchPanel key={batch.batch_id} batch={batch} />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-500">
            No hay lotes terminados todavía.
          </div>
        )}
      </section>
    </div>
  )
}

function HeroMetric({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-slate-300">{icon}</div>
      <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </div>
  )
}

function BatchPanel({
  batch,
  emphasize = false,
}: {
  batch: EtlBatchItem
  emphasize?: boolean
}) {
  const files = emphasize ? batch.files : batch.files.slice(0, RECENT_FILES_LIMIT)
  const hiddenCount = batch.files.length - files.length

  return (
    <article
      className={`rounded-3xl border p-5 ${
        emphasize
          ? 'border-amber-200 bg-gradient-to-br from-amber-50 to-white'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold text-slate-900">
              Lote {shortBatchId(batch.batch_id)}
            </span>
            <span className={`badge ${statusTone(batch.status)}`}>
              {statusLabel(batch.status)}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
              {batch.trigger_type}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Inicio: {formatDateTime(batch.started_at)}
            {batch.finished_at ? ` · Fin: ${formatDateTime(batch.finished_at)}` : ''}
          </p>
          {batch.data_dir && (
            <p className="mt-1 text-xs text-slate-400">{batch.data_dir}</p>
          )}
          {batch.error_message && (
            <p className="mt-3 max-w-3xl rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
              {batch.error_message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <BatchMetric label="Archivos" value={formatNumber(batch.file_count)} />
          <BatchMetric label="Activos" value={formatNumber(sumActiveFiles(batch))} />
          <BatchMetric label="Leídas" value={formatNumber(batch.rows_read_total)} />
          <BatchMetric
            label="Nuevas / Act"
            value={`${formatNumber(batch.rows_inserted_total)} / ${formatNumber(batch.rows_updated_total)}`}
          />
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {files.length > 0 ? (
          files.map((file) => <BatchFileRow key={file.id} file={file} />)
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
            Este lote no tiene archivos visibles.
          </div>
        )}
        {hiddenCount > 0 && (
          <div className="text-xs text-slate-400">
            +{formatNumber(hiddenCount)} archivo(s) adicionales en este lote
          </div>
        )}
      </div>
    </article>
  )
}

function BatchMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  )
}

function BatchFileRow({ file }: { file: EtlBatchFileItem }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-slate-900">{file.filename}</p>
            <span className={`badge ${statusTone(file.status)}`}>
              {statusLabel(file.status)}
            </span>
            {file.source_key && (
              <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500">
                {file.source_key}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Inicio: {formatDateTime(file.started_at)}
            {file.finished_at ? ` · Fin: ${formatDateTime(file.finished_at)}` : ''}
          </p>
          {file.error_message && (
            <p className="mt-2 text-xs text-red-600">{file.error_message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniMetric
            label="Leídas"
            value={file.rows_read > 0 ? formatNumber(file.rows_read) : '—'}
          />
          <MiniMetric label="Nuevas" value={formatNumber(file.rows_inserted)} />
          <MiniMetric label="Actualizadas" value={formatNumber(file.rows_updated)} />
          <MiniMetric label="Rechazadas" value={formatNumber(file.rows_rejected)} />
        </div>
      </div>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  )
}

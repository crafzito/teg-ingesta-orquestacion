import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  FolderOpen,
  PlayCircle,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { getEtlMonitor } from '../api'
import type { EtlDirectorySummary, EtlExecutionItem, EtlMonitorResponse, EtlSourceStatus } from '../types'

const POLL_MS = 15000

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return value
  return new Date(parsed).toLocaleString('es-VE', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function statusTone(status: string): string {
  if (status === 'SUCCESS') return 'bg-emerald-100 text-emerald-700'
  if (status === 'FAILED') return 'bg-red-100 text-red-700'
  if (status === 'RUNNING') return 'bg-amber-100 text-amber-700'
  return 'bg-slate-100 text-slate-600'
}

export default function EtlMonitorPage() {
  const [data, setData] = useState<EtlMonitorResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    void load()
    const timer = window.setInterval(() => {
      void load(true)
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [load])

  const summary = data?.summary
  const etlRunning = (summary?.running_count ?? 0) > 0
  const hasFailures = (summary?.sources_failed ?? 0) > 0

  return (
    <div className="w-full space-y-6">
      <div className="card p-5 bg-gradient-to-r from-slate-900 to-slate-800 border-0 text-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-300 text-sm">
              <Activity size={16} />
              Monitor operacional del ETL
            </div>
            <h2 className="text-xl font-semibold mt-2">Control en tiempo real de cargas y archivos</h2>
            <p className="text-slate-300 text-sm mt-1 max-w-3xl">
              Aquí puedes ver si el ETL está ejecutándose, cuál fue la última corrida,
              cuántos archivos hay en las carpetas monitoreadas y el estado reciente de cada fuente.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => void load(true)} className="btn-secondary">
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Actualizar
            </button>
            <div className="px-3 py-2 rounded-lg bg-white/10 text-xs text-slate-200">
              Auto-recarga cada 15s
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="card p-4 border-red-200 bg-red-50 text-sm text-red-700">
          No se pudo cargar el monitor del ETL: {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <MetricCard
          label="Estado ETL"
          value={
            loading
              ? 'Cargando…'
              : etlRunning
              ? 'Ejecutando'
              : hasFailures
              ? 'Revisar'
              : 'En espera'
          }
          hint={data ? `Actualizado: ${formatDateTime(data.generated_at)}` : 'Sin datos'}
          tone={
            loading
              ? 'bg-slate-50 text-slate-500'
              : etlRunning
              ? 'bg-amber-50 text-amber-700'
              : hasFailures
              ? 'bg-red-50 text-red-700'
              : 'bg-emerald-50 text-emerald-700'
          }
          icon={
            etlRunning
              ? <PlayCircle size={18} />
              : hasFailures
              ? <AlertCircle size={18} />
              : <CheckCircle2 size={18} />
          }
        />
        <MetricCard
          label="Ejecuciones activas"
          value={summary ? summary.running_count : '—'}
          hint="Fuentes con status RUNNING"
          tone="bg-blue-50 text-blue-700"
          icon={<Activity size={18} />}
        />
        <MetricCard
          label="Último éxito"
          value={summary ? formatDateTime(summary.last_success_at) : '—'}
          hint="Última carga exitosa registrada"
          tone="bg-emerald-50 text-emerald-700"
          icon={<CheckCircle2 size={18} />}
        />
        <MetricCard
          label="Archivos monitoreados"
          value={summary ? summary.total_files : '—'}
          hint={summary ? `${summary.csv_files} CSV y ${summary.xlsx_files} Excel` : 'Sin datos'}
          tone="bg-violet-50 text-violet-700"
          icon={<FolderOpen size={18} />}
        />
        <MetricCard
          label="Fuentes con fallo"
          value={summary ? summary.sources_failed : '—'}
          hint={summary ? `${summary.total_sources} fuentes visibles` : 'Sin datos'}
          tone="bg-red-50 text-red-700"
          icon={<XCircle size={18} />}
        />
      </div>

      {data && !data.database_available && (
        <div className="card p-4 border-amber-200 bg-amber-50 text-sm text-amber-800">
          La base de datos no respondió para las métricas del ETL. El monitor sigue mostrando
          los archivos detectados en disco.
          {data.database_error ? ` Detalle: ${data.database_error}` : ''}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <section className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Actividad actual</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Fuentes que están corriendo ahora mismo y última ejecución registrada.
                </p>
              </div>
              <span className={`badge ${etlRunning ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {etlRunning ? 'ETL activo' : 'ETL en espera'}
              </span>
            </div>

            {data && data.current_runs.length > 0 ? (
              <div className="space-y-3">
                {data.current_runs.map((run) => (
                  <RunCard key={run.id} run={run} />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                No hay ejecuciones en curso.
              </div>
            )}

            {data?.latest_execution && (
              <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500">Última ejecución registrada</p>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">
                      {data.latest_execution.source_key}
                    </p>
                  </div>
                  <span className={`badge ${statusTone(data.latest_execution.status)}`}>
                    {data.latest_execution.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3 text-xs">
                  <MiniStat label="Inicio" value={formatDateTime(data.latest_execution.started_at)} />
                  <MiniStat label="Fin" value={formatDateTime(data.latest_execution.finished_at)} />
                  <MiniStat label="Leídas" value={String(data.latest_execution.rows_read)} />
                  <MiniStat label="Rechazadas" value={String(data.latest_execution.rows_rejected)} />
                </div>
              </div>
            )}
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Estado por fuente</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Último resultado conocido de cada archivo o fuente del ETL.
                </p>
              </div>
              <div className="text-xs text-slate-400">
                {summary ? `${summary.sources_ok} OK · ${summary.sources_failed} con error` : 'Sin datos'}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="pb-2 font-medium">Fuente</th>
                    <th className="pb-2 font-medium">Estado</th>
                    <th className="pb-2 font-medium">Última carga</th>
                    <th className="pb-2 font-medium">Leídas</th>
                    <th className="pb-2 font-medium">Nuevas</th>
                    <th className="pb-2 font-medium">Sin cambios</th>
                    <th className="pb-2 font-medium">Rechazadas</th>
                  </tr>
                </thead>
                <tbody>
                  {data && data.source_status.length > 0 ? (
                    data.source_status.map((row) => <SourceStatusRow key={row.archivo} row={row} />)
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-5 text-center text-slate-500">
                        No hay información de fuentes todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Ejecuciones recientes</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Historial corto para revisar cuándo corrió cada fuente y cómo terminó.
                </p>
              </div>
              <span className="text-xs text-slate-400">Últimas 15</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="pb-2 font-medium">ID</th>
                    <th className="pb-2 font-medium">Fuente</th>
                    <th className="pb-2 font-medium">Estado</th>
                    <th className="pb-2 font-medium">Inicio</th>
                    <th className="pb-2 font-medium">Fin</th>
                    <th className="pb-2 font-medium">Leídas</th>
                    <th className="pb-2 font-medium">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {data && data.recent_executions.length > 0 ? (
                    data.recent_executions.map((run) => (
                      <tr key={run.id} className="border-b border-slate-100 last:border-b-0 align-top">
                        <td className="py-3 pr-3 font-mono text-xs text-slate-500">{run.id}</td>
                        <td className="py-3 pr-3">
                          <div className="font-medium text-slate-700">{run.source_key}</div>
                          <div className="text-xs text-slate-400 truncate max-w-64">{run.filepath}</div>
                        </td>
                        <td className="py-3 pr-3">
                          <span className={`badge ${statusTone(run.status)}`}>{run.status}</span>
                        </td>
                        <td className="py-3 pr-3 text-slate-600">{formatDateTime(run.started_at)}</td>
                        <td className="py-3 pr-3 text-slate-600">{formatDateTime(run.finished_at)}</td>
                        <td className="py-3 pr-3 text-slate-600">{run.rows_read}</td>
                        <td className="py-3 text-xs text-red-600 max-w-72">{run.error_message ?? '—'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-5 text-center text-slate-500">
                        No hay ejecuciones registradas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-5">
            <h3 className="text-sm font-semibold text-slate-700">Resumen operativo</h3>
            <div className="mt-4 space-y-3">
              <MiniStat label="Último inicio" value={summary ? formatDateTime(summary.last_started_at) : '—'} />
              <MiniStat label="Último fin" value={summary ? formatDateTime(summary.last_finished_at) : '—'} />
              <MiniStat label="Último fallo" value={summary ? formatDateTime(summary.last_failure_at) : '—'} />
              <MiniStat
                label="Último archivo detectado"
                value={summary ? formatDateTime(summary.latest_modified_file_at) : '—'}
              />
              <MiniStat
                label="Ejecuciones exitosas"
                value={summary ? String(summary.successful_executions) : '—'}
              />
              <MiniStat
                label="Ejecuciones fallidas"
                value={summary ? String(summary.failed_executions) : '—'}
              />
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-center gap-2">
              <FolderOpen size={16} className="text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-700">Carpetas monitoreadas</h3>
            </div>
            <div className="mt-4 space-y-4">
              {data?.directories.map((directory) => (
                <DirectoryCard key={directory.path} directory={directory} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string
  value: string | number
  hint: string
  tone: string
  icon: React.ReactNode
}) {
  return (
    <div className="card p-4">
      <div className={`inline-flex p-2 rounded-lg ${tone}`}>{icon}</div>
      <p className="text-xs text-slate-500 mt-3">{label}</p>
      <p className="text-lg font-semibold text-slate-800 mt-1 break-words">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{hint}</p>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-700 mt-1">{value}</p>
    </div>
  )
}

function RunCard({ run }: { run: EtlExecutionItem }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">{run.source_key}</p>
          <p className="text-xs text-slate-500 mt-0.5">{run.filepath}</p>
        </div>
        <span className="badge bg-amber-100 text-amber-700">{run.status}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <MiniStat label="Inicio" value={formatDateTime(run.started_at)} />
        <MiniStat label="Filas leídas" value={String(run.rows_read)} />
      </div>
    </div>
  )
}

function SourceStatusRow({ row }: { row: EtlSourceStatus }) {
  return (
    <tr className="border-b border-slate-100 last:border-b-0 align-top">
      <td className="py-3 pr-3 font-medium text-slate-700">{row.archivo}</td>
      <td className="py-3 pr-3">
        <span className={`badge ${statusTone(row.estado)}`}>{row.estado}</span>
      </td>
      <td className="py-3 pr-3 text-slate-600">{row.ultima_carga ?? '—'}</td>
      <td className="py-3 pr-3 text-slate-600">{row.leidas}</td>
      <td className="py-3 pr-3 text-slate-600">{row.nuevas}</td>
      <td className="py-3 pr-3 text-slate-600">{row.sin_cambios}</td>
      <td className="py-3 text-slate-600">
        <div>{row.rechazadas}</div>
        {row.error && <div className="text-xs text-red-600 mt-1 max-w-44">{row.error}</div>}
      </td>
    </tr>
  )
}

function DirectoryCard({ directory }: { directory: EtlDirectorySummary }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-800">{directory.name}</p>
          <p className="text-xs text-slate-400 mt-0.5 break-all">{directory.path}</p>
        </div>
        <span className={`badge ${directory.exists ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
          {directory.exists ? 'Disponible' : 'No existe'}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <MiniStat label="Archivos" value={String(directory.total_files)} />
        <MiniStat label="CSV" value={String(directory.csv_files)} />
        <MiniStat label="Excel" value={String(directory.xlsx_files)} />
      </div>
      <p className="text-xs text-slate-500 mt-3">
        Último archivo modificado: {formatDateTime(directory.latest_file_at)}
      </p>
      {directory.files.length > 0 && (
        <div className="mt-3 max-h-56 overflow-y-auto space-y-2">
          {directory.files.map((file) => (
            <div key={`${directory.path}-${file.name}`} className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                  <p className="text-xs text-slate-400">
                    {file.extension || 'sin extensión'} · {formatBytes(file.size_bytes)}
                  </p>
                </div>
                <div className="text-xs text-slate-400 text-right">
                  {formatDateTime(file.modified_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

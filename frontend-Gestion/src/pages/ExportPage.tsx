import { useEffect, useState, useCallback } from 'react'
import {
  Plus,
  X,
  ChevronDown,
  Copy,
  Check,
  Download,
  RefreshCw,
  AlertCircle,
  Info,
  Link,
  Terminal,
  FileJson,
  Braces,
} from 'lucide-react'
import type { BaseView, ViewColumn, ExportFilter, ExportResponse } from '../types'
import { getBaseViews, getAnyTableColumns, exportView, buildExportUrl } from '../api'
import { getBackendHttpOrigin } from '../config'

// ── Helpers de tipo (mismos que ViewsPage) ─────────────────────────────────
type ColKind = 'text' | 'number' | 'boolean' | 'date'

function colKind(dataType: string): ColKind {
  const t = dataType.toLowerCase()
  if (t.includes('bool')) return 'boolean'
  if (
    ['int', 'numeric', 'decimal', 'float', 'real', 'double', 'serial', 'money', 'smallint', 'bigint'].some(
      (k) => t.includes(k),
    )
  )
    return 'number'
  if (['date', 'time', 'timestamp', 'interval'].some((k) => t.includes(k))) return 'date'
  return 'text'
}

const OPS_TEXT = [
  { v: 'ILIKE', l: 'contiene' },
  { v: '=', l: 'es igual a' },
  { v: '!=', l: 'es diferente de' },
]
const OPS_NUMBER = [
  { v: '=', l: 'igual a' },
  { v: '!=', l: 'diferente de' },
  { v: '>', l: 'mayor que' },
  { v: '<', l: 'menor que' },
  { v: '>=', l: 'mayor o igual' },
  { v: '<=', l: 'menor o igual' },
]
const OPS_DATE = [
  { v: '>=', l: 'desde (fecha)' },
  { v: '<=', l: 'hasta (fecha)' },
  { v: '=', l: 'igual a' },
  { v: '>', l: 'posterior a' },
  { v: '<', l: 'anterior a' },
]
const OPS_BOOL = [
  { v: '=', l: 'es' },
  { v: '!=', l: 'no es' },
]

function getOps(kind: ColKind) {
  if (kind === 'number') return OPS_NUMBER
  if (kind === 'date') return OPS_DATE
  if (kind === 'boolean') return OPS_BOOL
  return OPS_TEXT
}

const EMPTY_FILTER: ExportFilter = { column: '', operator: 'ILIKE', value: '' }

const LIMIT_OPTIONS = [50, 100, 250, 500, 1_000, 2_500, 5_000]

// ── Helpers de UI ──────────────────────────────────────────────────────────
function useCopy(timeout = 2500) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), timeout)
    },
    [timeout],
  )
  return { copied, copy }
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Componente principal ───────────────────────────────────────────────────
export default function ExportPage() {
  const [baseViews, setBaseViews] = useState<BaseView[]>([])
  const [columns, setColumns] = useState<ViewColumn[]>([])
  const [loadingCols, setLoadingCols] = useState(false)
  const [selectedView, setSelectedView] = useState('') // "schema.viewname"
  const [filters, setFilters] = useState<ExportFilter[]>([])
  const [limit, setLimit] = useState(500)
  const [offset, setOffset] = useState(0)
  const [result, setResult] = useState<ExportResponse | null>(null)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const urlCopy = useCopy()
  const curlCopy = useCopy()
  const jsonCopy = useCopy()

  // Cargar vistas base al montar
  useEffect(() => {
    getBaseViews().then(setBaseViews).catch(() => {})
  }, [])

  // Cargar columnas cuando cambia la vista seleccionada
  useEffect(() => {
    if (!selectedView) {
      setColumns([])
      setFilters([])
      return
    }
    const [schema, viewName] = selectedView.split('.', 2)
    setLoadingCols(true)
    getAnyTableColumns(schema, viewName)
      .then(setColumns)
      .catch(() => setColumns([]))
      .finally(() => setLoadingCols(false))
    setFilters([])
    setResult(null)
    setError(null)
  }, [selectedView])

  const colMap = Object.fromEntries(columns.map((c) => [c.column_name, c]))

  // ── Gestión de filtros ──────────────────────────────────────────────────
  const addFilter = () => {
    const firstCol = columns[0]?.column_name ?? ''
    const kind = colKind(colMap[firstCol]?.data_type ?? 'text')
    setFilters((prev) => [
      ...prev,
      { ...EMPTY_FILTER, column: firstCol, operator: getOps(kind)[0].v },
    ])
  }

  const removeFilter = (idx: number) =>
    setFilters((prev) => prev.filter((_, i) => i !== idx))

  const updateFilter = (idx: number, patch: Partial<ExportFilter>) =>
    setFilters((prev) =>
      prev.map((f, i) => {
        if (i !== idx) return f
        const updated = { ...f, ...patch }
        if (patch.column !== undefined) {
          const kind = colKind(colMap[patch.column]?.data_type ?? 'text')
          updated.operator = getOps(kind)[0].v
          updated.value = ''
        }
        return updated
      }),
    )

  // ── URL del API ────────────────────────────────────────────────────────
  const viewName = selectedView ? selectedView.split('.', 2)[1] : ''
  const schema = selectedView ? selectedView.split('.', 2)[0] : 'public'
  const exportParams = { schema, limit, offset, filters }

  const absoluteUrl = selectedView
    ? buildExportUrl(viewName, exportParams, true)
    : `${getBackendHttpOrigin()}/api/export/{vista}?...`

  const curlCmd = `curl -s "${absoluteUrl}"`

  // ── Fetch de datos ─────────────────────────────────────────────────────
  const handleFetch = async () => {
    if (!selectedView) return
    setFetching(true)
    setError(null)
    setResult(null)
    try {
      const data = await exportView(viewName, exportParams)
      setResult(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setFetching(false)
    }
  }

  // Agrupar vistas por schema para el <optgroup>
  const grouped: Record<string, BaseView[]> = {}
  for (const bv of baseViews) {
    ;(grouped[bv.schema_name] ??= []).push(bv)
  }

  const hasView = Boolean(selectedView)
  const activeFilters = filters.filter((f) => f.column && f.operator && f.value.trim())

  return (
    <div className="w-full space-y-5">
      {/* Banner informativo */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
        <Info size={16} className="shrink-0 mt-0.5 text-blue-500" />
        <p>
          Selecciona una vista, aplica los filtros que necesites y obtén los datos en{' '}
          <strong>formato JSON</strong>. También puedes usar la <strong>URL del API</strong>{' '}
          directamente desde tu código, Postman o cualquier herramienta HTTP.
        </p>
      </div>

      {/* Layout 2 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ── Columna izquierda: configuración ─────────────────────────── */}
        <div className="card p-5 space-y-5">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Braces size={15} className="text-blue-500" />
            Configuración de la exportación
          </h3>

          {/* Selector de vista */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Vista a exportar <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                className="input appearance-none pr-8"
                value={selectedView}
                onChange={(e) => setSelectedView(e.target.value)}
              >
                <option value="">Selecciona una vista…</option>
                {Object.entries(grouped).map(([sch, views]) => (
                  <optgroup key={sch} label={`Schema: ${sch}`}>
                    {views.map((v) => (
                      <option key={v.full_name} value={v.full_name}>
                        {v.full_name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          </div>

          {/* Límite */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Límite de registros
              </label>
              <div className="relative">
                <select
                  className="input appearance-none pr-8"
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                >
                  {LIMIT_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n.toLocaleString()} registros
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Saltar (offset)
              </label>
              <input
                type="number"
                className="input"
                min={0}
                step={limit}
                value={offset}
                onChange={(e) => setOffset(Math.max(0, Number(e.target.value)))}
                placeholder="0"
              />
            </div>
          </div>

          {/* Filtros */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">
                Filtros{' '}
                {activeFilters.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                    {activeFilters.length}
                  </span>
                )}
              </label>
              <button
                onClick={addFilter}
                disabled={!hasView || loadingCols}
                className="btn-secondary text-xs py-1 px-2.5 disabled:opacity-40"
              >
                <Plus size={12} />
                Agregar filtro
              </button>
            </div>

            {filters.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                {!hasView
                  ? 'Selecciona una vista para agregar filtros'
                  : 'Sin filtros — se exportarán todos los registros'}
              </div>
            ) : (
              <div className="space-y-2">
                {filters.map((filter, idx) => {
                  const kind = colKind(colMap[filter.column]?.data_type ?? 'text')
                  const ops = getOps(kind)
                  return (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2"
                    >
                      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                        {/* Campo */}
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Campo</p>
                          {loadingCols ? (
                            <input className="input text-xs" placeholder="Cargando…" disabled />
                          ) : (
                            <select
                              className="input text-xs appearance-none"
                              value={filter.column}
                              onChange={(e) => updateFilter(idx, { column: e.target.value })}
                            >
                              <option value="">Selecciona…</option>
                              {columns.map((c) => (
                                <option key={c.column_name} value={c.column_name}>
                                  {c.column_name} — {c.data_type}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        {/* Condición */}
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Condición</p>
                          <select
                            className="input text-xs appearance-none"
                            value={filter.operator}
                            onChange={(e) => updateFilter(idx, { operator: e.target.value })}
                          >
                            {ops.map((o) => (
                              <option key={o.v} value={o.v}>
                                {o.l}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          onClick={() => removeFilter(idx)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors mb-0.5"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      {/* Valor */}
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Valor</p>
                        {kind === 'boolean' ? (
                          <select
                            className="input text-xs appearance-none"
                            value={filter.value}
                            onChange={(e) => updateFilter(idx, { value: e.target.value })}
                          >
                            <option value="">Selecciona…</option>
                            <option value="true">Sí / Verdadero</option>
                            <option value="false">No / Falso</option>
                          </select>
                        ) : kind === 'date' ? (
                          <input
                            type="date"
                            className="input text-xs"
                            value={filter.value}
                            onChange={(e) => updateFilter(idx, { value: e.target.value })}
                          />
                        ) : (
                          <input
                            type={kind === 'number' ? 'number' : 'text'}
                            className="input text-xs"
                            placeholder={kind === 'number' ? 'ej: 1000' : 'ej: texto a buscar'}
                            value={filter.value}
                            onChange={(e) => updateFilter(idx, { value: e.target.value })}
                          />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Botón de acción */}
          <button
            onClick={handleFetch}
            disabled={!hasView || fetching}
            className="btn-primary w-full disabled:opacity-50 py-2.5"
          >
            {fetching ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                Obteniendo datos…
              </>
            ) : (
              <>
                <FileJson size={15} />
                Obtener JSON
              </>
            )}
          </button>
        </div>

        {/* ── Columna derecha: URL + resultado ─────────────────────────── */}
        <div className="space-y-4">
          {/* URL del API */}
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Link size={14} className="text-slate-400" />
              URL del API
            </h3>
            <div className="bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
                <span className="text-xs text-slate-400 font-mono">GET</span>
                <button
                  onClick={() => urlCopy.copy(absoluteUrl)}
                  disabled={!hasView}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors disabled:opacity-40 ${
                    urlCopy.copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                  }`}
                >
                  {urlCopy.copied ? <Check size={11} /> : <Copy size={11} />}
                  {urlCopy.copied ? '¡Copiado!' : 'Copiar URL'}
                </button>
              </div>
              <pre className="px-3 py-2.5 text-blue-300 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
                {absoluteUrl}
              </pre>
            </div>

            {/* curl */}
            <div className="bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
                <div className="flex items-center gap-1.5">
                  <Terminal size={11} className="text-slate-400" />
                  <span className="text-xs text-slate-400">curl</span>
                </div>
                <button
                  onClick={() => curlCopy.copy(curlCmd)}
                  disabled={!hasView}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors disabled:opacity-40 ${
                    curlCopy.copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                  }`}
                >
                  {curlCopy.copied ? <Check size={11} /> : <Copy size={11} />}
                  {curlCopy.copied ? '¡Copiado!' : 'Copiar curl'}
                </button>
              </div>
              <pre className="px-3 py-2.5 text-amber-300 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
                {curlCmd}
              </pre>
            </div>

            {/* Hint de paginación */}
            <p className="text-xs text-slate-400">
              Para paginar agrega <span className="font-mono bg-slate-100 px-1 rounded">&offset=500</span> en la URL.
              Máximo <span className="font-mono bg-slate-100 px-1 rounded">5000</span> registros por llamada.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Resultado JSON */}
          {result && (
            <div className="card p-4 space-y-3">
              {/* Estadísticas */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-700">
                    Resultado
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                    {result.returned_records.toLocaleString()} registros
                  </span>
                  {result.truncated && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                      {result.total_records.toLocaleString()} totales — truncado
                    </span>
                  )}
                  <span className="text-xs text-slate-400">
                    {result.execution_time_ms} ms
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      downloadJson(result, `${result.view}_${Date.now()}.json`)
                    }
                    className="btn-secondary text-xs py-1.5 px-3"
                  >
                    <Download size={12} />
                    Descargar .json
                  </button>
                  <button
                    onClick={() =>
                      jsonCopy.copy(JSON.stringify(result.data, null, 2))
                    }
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      jsonCopy.copied
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {jsonCopy.copied ? <Check size={12} /> : <Copy size={12} />}
                    {jsonCopy.copied ? '¡Copiado!' : 'Copiar JSON'}
                  </button>
                </div>
              </div>

              {/* Preview de los primeros registros */}
              <div className="bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
                  <span className="text-xs text-slate-400">
                    {result.data.length > 5
                      ? `Mostrando primeros 5 de ${result.returned_records.toLocaleString()}`
                      : `${result.returned_records} registro${result.returned_records !== 1 ? 's' : ''}`}
                  </span>
                </div>
                <pre className="px-3 py-3 text-green-400 text-xs font-mono leading-relaxed overflow-x-auto max-h-72">
                  {JSON.stringify(result.data.slice(0, 5), null, 2)}
                  {result.data.length > 5 && '\n\n// … ' + (result.data.length - 5).toLocaleString() + ' registros más'}
                </pre>
              </div>

              {result.truncated && (
                <p className="text-xs text-amber-600 flex items-center gap-1.5">
                  <AlertCircle size={12} />
                  Hay {(result.total_records - result.returned_records).toLocaleString()} registros adicionales. Aumenta el límite o usa <span className="font-mono bg-amber-50 px-1 rounded">offset</span> para paginar.
                </p>
              )}
            </div>
          )}

          {/* Estado vacío */}
          {!result && !error && !fetching && (
            <div className="card p-8 text-center text-slate-400">
              <FileJson size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Configura la vista y los filtros,<br />luego haz clic en «Obtener JSON»</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

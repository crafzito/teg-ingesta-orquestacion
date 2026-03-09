import { useEffect, useState, useCallback } from 'react'
import {
  Plus,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  X,
  ChevronDown,
  Info,
  Shield,
  Sparkles,
  Eye,
  CheckCircle2,
  ExternalLink,
  AlertCircle,
  Database,
} from 'lucide-react'
import type { LookerView, BaseView, ViewColumn, CreateViewRequest, ViewFilter } from '../types'
import { getLookerViews, getBaseViews, getViewColumns, createLookerView, deleteLookerView } from '../api'

const CATEGORY_COLORS: Record<string, string> = {
  Ventas: 'bg-blue-100 text-blue-700',
  'Ctas por Cobrar': 'bg-purple-100 text-purple-700',
  'Ctas por Pagar': 'bg-orange-100 text-orange-700',
  Inventario: 'bg-teal-100 text-teal-700',
  Órdenes: 'bg-yellow-100 text-yellow-700',
  Pedidos: 'bg-pink-100 text-pink-700',
  Dimensión: 'bg-slate-100 text-slate-600',
  Personalizada: 'bg-emerald-100 text-emerald-700',
}

// ── Helpers de tipo (igual que SqlExplorer) ────────────────────────────────
type ColKind = 'text' | 'number' | 'boolean' | 'date'

function colKind(dataType: string): ColKind {
  const t = dataType.toLowerCase()
  if (t.includes('bool')) return 'boolean'
  if (['int','numeric','decimal','float','real','double','serial','money','smallint','bigint'].some(k => t.includes(k))) return 'number'
  if (['date','time','timestamp','interval'].some(k => t.includes(k))) return 'date'
  return 'text'
}

const OPS_TEXT    = [{ v:'ILIKE', l:'contiene el texto' }, { v:'=', l:'es igual a' }, { v:'!=', l:'es diferente de' }]
const OPS_NUMBER  = [{ v:'=', l:'es igual a' }, { v:'!=', l:'es diferente de' }, { v:'>', l:'mayor que' }, { v:'<', l:'menor que' }, { v:'>=', l:'mayor o igual a' }, { v:'<=', l:'menor o igual a' }]
const OPS_DATE    = [{ v:'=', l:'es igual a' }, { v:'>=', l:'desde (fecha)' }, { v:'<=', l:'hasta (fecha)' }, { v:'>', l:'posterior a' }, { v:'<', l:'anterior a' }]
const OPS_BOOL    = [{ v:'=', l:'es igual a' }, { v:'!=', l:'es diferente de' }]

function getOps(kind: ColKind) {
  if (kind === 'number')  return OPS_NUMBER
  if (kind === 'date')    return OPS_DATE
  if (kind === 'boolean') return OPS_BOOL
  return OPS_TEXT
}

export default function ViewsPage() {
  const [views, setViews] = useState<LookerView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [copiedName, setCopiedName] = useState<string | null>(null)
  const [deletingName, setDeletingName] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    getLookerViews()
      .then(setViews)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleCopy = (name: string) => {
    navigator.clipboard.writeText(name)
    setCopiedName(name)
    setTimeout(() => setCopiedName(null), 2000)
  }

  const handleDelete = async (name: string) => {
    if (!confirm(`¿Eliminar la vista "${name}"? Esta acción no se puede deshacer.`)) return
    setDeletingName(name)
    try {
      await deleteLookerView(name)
      setViews((prev) => prev.filter((v) => v.name !== name))
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setDeletingName(null)
    }
  }

  const handleCreated = (name: string) => {
    setShowModal(false)
    load()
    // Show success briefly
    setCopiedName(`__created_${name}`)
    setTimeout(() => setCopiedName(null), 3000)
  }

  return (
    <div className="w-full space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">
            {loading ? 'Cargando…' : `${views.length} vistas disponibles`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-secondary" disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus size={14} />
            Nueva vista personalizada
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
        <Info size={16} className="mt-0.5 shrink-0 text-blue-500" />
        <p>
          Las vistas marcadas con <Shield size={12} className="inline mx-1" />
          <strong>Protegida</strong> son parte del sistema y no pueden eliminarse. Las vistas
          con <Sparkles size={12} className="inline mx-1" />
          <strong>Personalizada</strong> las creaste tú y puedes eliminarlas cuando quieras.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
          Error al cargar vistas: {error}
        </div>
      )}

      {/* Created success */}
      {copiedName?.startsWith('__created_') && (
        <div className="flex items-center gap-2 p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700">
          <Check size={16} />
          Vista <strong>{copiedName.replace('__created_', '')}</strong> creada correctamente.
        </div>
      )}

      {/* Vista grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-1/2 mb-4" />
              <div className="h-16 bg-slate-50 rounded mb-3" />
              <div className="h-7 bg-slate-100 rounded w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {views.map((view) => (
            <ViewCard
              key={view.name}
              view={view}
              onCopy={handleCopy}
              onDelete={handleDelete}
              copied={copiedName === view.name}
              deleting={deletingName === view.name}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <CreateViewModal onClose={() => setShowModal(false)} onCreated={handleCreated} />
      )}
    </div>
  )
}

// ---- ViewCard ----

function ViewCard({
  view,
  onCopy,
  onDelete,
  copied,
  deleting,
}: {
  view: LookerView
  onCopy: (name: string) => void
  onDelete: (name: string) => void
  copied: boolean
  deleting: boolean
}) {
  const categoryColor = CATEGORY_COLORS[view.category] ?? 'bg-slate-100 text-slate-600'

  return (
    <div className="card p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {view.is_custom ? (
              <Sparkles size={13} className="text-emerald-500 shrink-0" />
            ) : (
              <Shield size={13} className="text-slate-400 shrink-0" />
            )}
            <span className="font-mono text-sm font-semibold text-slate-800 truncate">
              {view.name}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            schema: <span className="font-mono">public</span>
          </p>
        </div>
        <span className={`badge shrink-0 ${categoryColor}`}>{view.category}</span>
      </div>

      {/* SQL snippet */}
      <div className="bg-slate-50 rounded-lg p-2.5 flex-1">
        <div className="flex items-center gap-1 mb-1">
          <Eye size={11} className="text-slate-400" />
          <span className="text-xs text-slate-400">Definición</span>
        </div>
        <p className="text-xs font-mono text-slate-500 leading-relaxed line-clamp-3">
          {view.view_definition
            ? view.view_definition.replace(/\s+/g, ' ').substring(0, 140) + '…'
            : 'Sin definición'}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onCopy(view.name)}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            copied
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
          title="Copiar nombre para usar en Looker Studio"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copiado' : 'Copiar nombre'}
        </button>

        {view.is_custom && (
          <button
            onClick={() => onDelete(view.name)}
            disabled={deleting}
            className="btn-danger"
            title="Eliminar esta vista personalizada"
          >
            <Trash2 size={12} />
            {deleting ? 'Eliminando…' : 'Eliminar'}
          </button>
        )}
      </div>
    </div>
  )
}

// ---- CreateViewModal ----

const EMPTY_FILTER: ViewFilter = { column: '', operator: 'ILIKE', value: '' }

function CreateViewModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (name: string) => void
}) {
  const [baseViews, setBaseViews]   = useState<BaseView[]>([])
  const [columns, setColumns]       = useState<ViewColumn[]>([])
  const [loadingCols, setLoadingCols] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [createdName, setCreatedName] = useState<string | null>(null)  // estado de éxito
  const [copiedSql, setCopiedSql]   = useState(false)
  const [copiedDdl, setCopiedDdl]   = useState(false)

  const [form, setForm] = useState<CreateViewRequest>({
    name: '', base_view: '', description: '', filters: [],
  })

  useEffect(() => { getBaseViews().then(setBaseViews).catch(() => {}) }, [])

  useEffect(() => {
    if (!form.base_view) return
    const viewName = form.base_view.split('.')[1]
    setLoadingCols(true)
    getViewColumns(viewName)
      .then(setColumns)
      .catch(() => setColumns([]))
      .finally(() => setLoadingCols(false))
  }, [form.base_view])

  const colMap = Object.fromEntries(columns.map((c) => [c.column_name, c]))

  const addFilter = () =>
    setForm((f) => ({ ...f, filters: [...f.filters, { ...EMPTY_FILTER, column: columns[0]?.column_name ?? '' }] }))

  const removeFilter = (idx: number) =>
    setForm((f) => ({ ...f, filters: f.filters.filter((_, i) => i !== idx) }))

  const updateFilter = (idx: number, patch: Partial<ViewFilter>) =>
    setForm((f) => ({
      ...f,
      filters: f.filters.map((fl, i) => {
        if (i !== idx) return fl
        const updated = { ...fl, ...patch }
        if (patch.column !== undefined) {
          const kind = colKind(colMap[patch.column]?.data_type ?? 'text')
          updated.operator = getOps(kind)[0].v
          updated.value = ''
        }
        return updated
      }),
    }))

  // SQL del CREATE VIEW (DDL)
  const buildDdl = () => {
    if (!form.name || !form.base_view) return '-- Completa el nombre y la vista base'
    const [schema, view] = form.base_view.split('.')
    const valid = form.filters.filter((f) => f.column && f.operator && f.value.trim())
    let sql = `CREATE OR REPLACE VIEW public."${form.name}" AS\nSELECT *\nFROM ${schema}."${view}"`
    if (valid.length) {
      const clauses = valid.map((f) => {
        const kind = colKind(colMap[f.column]?.data_type ?? 'text')
        const v = f.value.replace(/'/g, "''")
        if (kind === 'boolean') return `"${f.column}" = ${f.value.toLowerCase() === 'true' || f.value === '1' ? 'TRUE' : 'FALSE'}`
        if (kind === 'number')  return `"${f.column}" ${f.operator} ${f.value}`
        if (f.operator === 'ILIKE') return `"${f.column}" ILIKE '%${v}%'`
        return `"${f.column}" ${f.operator} '${v}'`
      })
      sql += '\nWHERE ' + clauses.join('\n  AND ')
    }
    return sql
  }

  // Query SELECT para Looker Studio
  const buildSelectQuery = (name = form.name) => {
    if (!name) return '-- Completa el nombre primero'
    return `SELECT *\nFROM public."${name}"`
  }

  const handleSubmit = async () => {
    if (!form.name)      { setSubmitError('El nombre de la vista es obligatorio'); return }
    if (!form.base_view) { setSubmitError('Selecciona una vista base'); return }
    if (!/^[a-z][a-z0-9_]{0,62}$/.test(form.name)) {
      setSubmitError('El nombre solo puede tener letras minúsculas, números y guiones bajos (_)')
      return
    }
    setSubmitError(null)
    setSubmitting(true)
    try {
      await createLookerView(form)
      setCreatedName(form.name)
      onCreated(form.name)
    } catch (e) {
      setSubmitError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const groupedViews: Record<string, BaseView[]> = {}
  for (const bv of baseViews) { (groupedViews[bv.schema_name] ??= []).push(bv) }

  // ── Estado de éxito ────────────────────────────────────────────────────
  if (createdName) {
    const selectQuery = buildSelectQuery(createdName)
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
          {/* Header éxito */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-full">
                <CheckCircle2 size={20} className="text-emerald-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-800">¡Vista creada correctamente!</h2>
                <p className="text-xs text-slate-500 mt-0.5">Ya está disponible en la base de datos</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
              <X size={16} className="text-slate-500" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            {/* Badge del nombre */}
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <Database size={15} className="text-slate-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400 mb-0.5">Nombre de la vista en PostgreSQL</p>
                <p className="font-mono text-sm font-semibold text-slate-800">public.{createdName}</p>
              </div>
            </div>

            {/* Explicación Looker Studio */}
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <ExternalLink size={14} className="text-blue-500 shrink-0" />
                <p className="text-sm font-semibold text-blue-800">¿Cómo usarla en Looker Studio?</p>
              </div>
              <ol className="space-y-1 text-xs text-blue-700 list-none">
                {[
                  'En Looker Studio → agrega fuente de datos → PostgreSQL',
                  'Schema: public → selecciona la vista por su nombre, ó',
                  'Usa «Consulta personalizada» y pega el SQL de abajo',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="inline-flex w-4 h-4 rounded-full bg-blue-200 text-blue-800 text-xs font-bold items-center justify-center shrink-0 mt-0.5">{i+1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            {/* SELECT query para Looker */}
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                Query para «Consulta personalizada» en Looker Studio
              </p>
              <div className="bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
                  <span className="text-xs text-slate-400">SELECT query</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(selectQuery); setCopiedSql(true); setTimeout(() => setCopiedSql(false), 2500) }}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors ${copiedSql ? 'bg-emerald-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                  >
                    {copiedSql ? <Check size={11} /> : <Copy size={11} />}
                    {copiedSql ? '¡Copiado!' : 'Copiar'}
                  </button>
                </div>
                <pre className="px-3 py-2.5 text-green-400 text-xs font-mono leading-relaxed">{selectQuery}</pre>
              </div>
            </div>
          </div>

          <div className="flex justify-end px-6 py-4 border-t border-slate-100">
            <button onClick={onClose} className="btn-primary">
              <Check size={14} />
              Entendido
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Formulario de creación ─────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Nueva vista personalizada</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Define los filtros y la vista quedará guardada en la base de datos para conectar en Looker Studio
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        {/* Info banner */}
        <div className="mx-6 mt-4 flex items-start gap-2.5 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
          <Info size={14} className="shrink-0 mt-0.5 text-blue-500" />
          <span>
            La vista se creará en el schema <span className="font-mono font-semibold">public</span> de PostgreSQL.
            Desde Looker Studio podrás conectarte a ella igual que a cualquier otra vista — busca su nombre en la lista
            o pégala como «Consulta personalizada».
          </span>
        </div>

        {/* Cuerpo: 2 columnas en lg */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

            {/* ── Columna izquierda: formulario ── */}
            <div className="space-y-4">

              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nombre de la vista <span className="text-red-500">*</span>
                </label>
                <input
                  className="input"
                  placeholder="ej: ventas_pharsana_2024"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                />
                {form.name ? (
                  <p className="text-xs text-emerald-600 mt-1 font-mono">
                    → Aparecerá como: <strong>public.{form.name}</strong>
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 mt-1">
                    Solo letras minúsculas, números y guiones bajos. Sin espacios ni caracteres especiales.
                  </p>
                )}
              </div>

              {/* Vista base */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Vista base <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    className="input appearance-none pr-8"
                    value={form.base_view}
                    onChange={(e) => setForm((f) => ({ ...f, base_view: e.target.value, filters: [] }))}
                  >
                    <option value="">Selecciona la fuente de datos…</option>
                    {Object.entries(groupedViews).map(([schema, bvs]) => (
                      <optgroup key={schema} label={`Schema: ${schema}`}>
                        {bvs.map((bv) => (
                          <option key={bv.full_name} value={bv.full_name}>
                            {bv.full_name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Tu nueva vista será un subconjunto (con filtros) de la vista que elijas aquí.
                </p>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Descripción <span className="text-slate-400 font-normal text-xs">(opcional)</span>
                </label>
                <input
                  className="input"
                  placeholder="ej: Ventas de Pharsana durante 2024"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>

              {/* Filtros */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">
                    Filtros <span className="text-slate-400 font-normal text-xs">(opcional)</span>
                  </label>
                  <button
                    onClick={addFilter}
                    disabled={!form.base_view || loadingCols}
                    className="btn-secondary text-xs py-1 px-2.5 disabled:opacity-40"
                  >
                    <Plus size={12} />
                    Agregar filtro
                  </button>
                </div>

                {form.filters.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                    {!form.base_view
                      ? 'Primero selecciona una vista base'
                      : 'Sin filtros — la vista mostrará todos los registros de la fuente'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {form.filters.map((filter, idx) => {
                      const kind = colKind(colMap[filter.column]?.data_type ?? 'text')
                      const ops = getOps(kind)
                      return (
                        <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
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
                                  <option key={o.v} value={o.v}>{o.l}</option>
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
                                <option value="true">Sí / Verdadero (true)</option>
                                <option value="false">No / Falso (false)</option>
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
                                placeholder={kind === 'number' ? 'ej: 1000' : 'ej: Pharsana'}
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
            </div>

            {/* ── Columna derecha: SQL siempre visible ── */}
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  SQL que se ejecutará en la base de datos
                </p>
                <div className="bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
                    <span className="text-xs text-slate-400">CREATE OR REPLACE VIEW…</span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(buildDdl()); setCopiedDdl(true); setTimeout(() => setCopiedDdl(false), 2500) }}
                      className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors ${copiedDdl ? 'bg-emerald-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                    >
                      {copiedDdl ? <Check size={11} /> : <Copy size={11} />}
                      {copiedDdl ? '¡Copiado!' : 'Copiar'}
                    </button>
                  </div>
                  <pre className="px-3 py-3 text-green-400 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre">
                    {buildDdl()}
                  </pre>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                  Query para usar en Looker Studio
                </p>
                <div className="bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
                    <span className="text-xs text-slate-400">SELECT query → «Consulta personalizada»</span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(buildSelectQuery()); setCopiedSql(true); setTimeout(() => setCopiedSql(false), 2500) }}
                      className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors ${copiedSql ? 'bg-emerald-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                    >
                      {copiedSql ? <Check size={11} /> : <Copy size={11} />}
                      {copiedSql ? '¡Copiado!' : 'Copiar'}
                    </button>
                  </div>
                  <pre className="px-3 py-3 text-blue-300 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre">
                    {buildSelectQuery()}
                  </pre>
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                  Pégala en Looker Studio → Fuente de datos → PostgreSQL → «Consulta personalizada».
                </p>
              </div>

              {submitError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" />
                  {submitError}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleSubmit} disabled={submitting || !form.name || !form.base_view} className="btn-primary disabled:opacity-50">
            {submitting
              ? <><RefreshCw size={14} className="animate-spin" />Creando…</>
              : <><Plus size={14} />Crear vista en base de datos</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import {
  Play, Plus, X, HelpCircle, Database, Clock, Rows,
  AlertCircle, RefreshCw, Copy, Check, Info, Sparkles,
  BarChart3, BookOpen, Tag,
} from 'lucide-react'
import type { ViewColumn, ViewFilter, QueryResponse } from '../types'
import { getLookerViews, getAnyTableColumns, executeQuery } from '../api'

// ── Tipos ─────────────────────────────────────────────────────────────────

interface TableInfo {
  schema: string
  name: string
  label: string
  description: string
  group: 'Reportes' | 'Dimensiones' | 'Hechos' | 'Catálogos' | 'Personalizadas'
  isCustom?: boolean
}

// Clasificación de tipos PostgreSQL
type ColKind = 'text' | 'number' | 'boolean' | 'date'

function colKind(dataType: string): ColKind {
  const t = dataType.toLowerCase()
  if (t.includes('bool')) return 'boolean'
  if (['int', 'numeric', 'decimal', 'float', 'real', 'double', 'serial', 'money', 'smallint', 'bigint'].some((k) => t.includes(k))) return 'number'
  if (['date', 'time', 'timestamp', 'interval'].some((k) => t.includes(k))) return 'date'
  return 'text'
}

// Operadores por tipo de dato
const OPERATORS_TEXT = [
  { value: 'ILIKE', label: 'contiene el texto',  hint: 'No distingue mayúsculas. Ej: Pharsana', placeholder: 'ej: Pharsana' },
  { value: '=',     label: 'es igual a',          hint: 'Coincidencia exacta. Ej: Valencia',     placeholder: 'ej: Valencia' },
  { value: '!=',    label: 'es diferente de',      hint: 'Excluye ese valor exacto.',             placeholder: 'ej: 1000' },
]
const OPERATORS_NUMBER = [
  { value: '=',  label: 'es igual a',     hint: 'Ej: 1000',  placeholder: 'ej: 1000' },
  { value: '!=', label: 'es diferente de', hint: 'Ej: 1300',  placeholder: 'ej: 1300' },
  { value: '>',  label: 'mayor que',       hint: 'Ej: 100',   placeholder: 'ej: 100' },
  { value: '<',  label: 'menor que',       hint: 'Ej: 50',    placeholder: 'ej: 50' },
  { value: '>=', label: 'mayor o igual a', hint: 'Ej: 1000',  placeholder: 'ej: 1000' },
  { value: '<=', label: 'menor o igual a', hint: 'Ej: 5000',  placeholder: 'ej: 5000' },
]
const OPERATORS_DATE = [
  { value: '=',  label: 'es igual a',     hint: 'Ej: 2024-01-15', placeholder: 'ej: 2024-01-15' },
  { value: '>=', label: 'desde (fecha)',   hint: 'Ej: 2024-01-01', placeholder: 'ej: 2024-01-01' },
  { value: '<=', label: 'hasta (fecha)',   hint: 'Ej: 2024-12-31', placeholder: 'ej: 2024-12-31' },
  { value: '>',  label: 'posterior a',     hint: 'Ej: 2024-06-30', placeholder: 'ej: 2024-06-30' },
  { value: '<',  label: 'anterior a',      hint: 'Ej: 2024-06-01', placeholder: 'ej: 2024-06-01' },
]

function getOperators(kind: ColKind) {
  if (kind === 'number') return OPERATORS_NUMBER
  if (kind === 'date')   return OPERATORS_DATE
  if (kind === 'boolean') return OPERATORS_TEXT.filter((o) => ['=', '!='].includes(o.value))
  return OPERATORS_TEXT
}

// Validar valor según tipo
function validateFilterValue(value: string, kind: ColKind): string | null {
  if (!value.trim()) return 'El valor no puede estar vacío'
  if (kind === 'number' && isNaN(Number(value)))
    return `"${value}" no es un número válido. Ingresa solo dígitos (ej: 1000)`
  if (kind === 'boolean' && !['true', 'false', '1', '0', 'si', 'no'].includes(value.toLowerCase()))
    return `Para este campo solo se acepta: true o false`
  if (kind === 'date' && !/^\d{4}-\d{2}-\d{2}/.test(value))
    return `La fecha debe tener formato YYYY-MM-DD (ej: 2024-01-15)`
  return null
}

const LIMIT_OPTIONS = [10, 25, 50, 100, 500]

// ── Tablas del sistema ────────────────────────────────────────────────────

const SYSTEM_TABLES: TableInfo[] = [
  // ── Reportes (vistas amigables para usuarios finales) ────────────────────
  { schema: 'public', name: 'v_ventas',     label: 'Ventas',           group: 'Reportes',    description: 'Facturas emitidas: cliente, material, montos en Bs y USD, vendedor, canal.' },
  { schema: 'public', name: 'v_cxc',        label: 'Ctas. por Cobrar', group: 'Reportes',    description: 'Facturas pendientes de cobro con antigüedad por tramos (1-15, 16-30, 31-60…).' },
  { schema: 'public', name: 'v_cxp',        label: 'Ctas. por Pagar',  group: 'Reportes',    description: 'Facturas a proveedores con montos vencidos por tramos y moneda fuerte.' },
  { schema: 'public', name: 'v_inventario', label: 'Inventario',       group: 'Reportes',    description: 'Stock disponible por material y almacén con unidades (libre, calidad, bloqueado).' },
  { schema: 'public', name: 'v_ordenes',    label: 'Órdenes de Prod.', group: 'Reportes',    description: 'Órdenes de fabricación con estado, fechas, avance % y cantidad recibida.' },
  { schema: 'public', name: 'v_pedidos',    label: 'Pedidos SAP',      group: 'Reportes',    description: 'Pedidos de clientes: cantidades confirmadas vs pedidas, precios y entregas.' },
  // ── Dimensiones (maestros de datos) ─────────────────────────────────────
  { schema: 'public', name: 'dim_sociedad', label: 'Sociedades',        group: 'Dimensiones', description: 'Empresas del grupo (Pharsana, Ampofrasca, PET): código, nombre, tipo de producción.' },
  { schema: 'public', name: 'dim_centro',   label: 'Plantas / Centros', group: 'Dimensiones', description: 'Plantas productivas y almacenes con nombre y sociedad a la que pertenecen.' },
  { schema: 'public', name: 'dim_producto', label: 'Materiales',        group: 'Dimensiones', description: 'Catálogo de materiales SAP: código, denominación, categoría, marca y jerarquías.' },
  { schema: 'public', name: 'dim_cliente',  label: 'Clientes',          group: 'Dimensiones', description: 'Directorio de clientes: RIF, dirección, condición de pago, canal y vendedor asignado.' },
  { schema: 'public', name: 'dim_vendedor', label: 'Vendedores',        group: 'Dimensiones', description: 'Representantes comerciales: código, nombre y tipo (vendedor / gerente).' },
  // ── Hechos (tablas transaccionales brutas) ───────────────────────────────
  { schema: 'public', name: 'fact_ventas',         label: 'Ventas (raw)',        group: 'Hechos', description: 'Datos crudos de facturas SAP con montos en Bs y USD, tipo de cambio y pesos.' },
  { schema: 'public', name: 'fact_cxc',            label: 'CxC (raw)',           group: 'Hechos', description: 'Cuentas por cobrar sin transformar: documento, cliente, vencimientos por tramos.' },
  { schema: 'public', name: 'fact_cxp',            label: 'CxP (raw)',           group: 'Hechos', description: 'Cuentas por pagar brutas: proveedor, vencimientos, importe en moneda fuerte.' },
  { schema: 'public', name: 'fact_inventario',     label: 'Inventario (raw)',    group: 'Hechos', description: 'Snapshots de stock por almacén y material: libre, en calidad y bloqueado.' },
  { schema: 'public', name: 'fact_ordenes',        label: 'Órdenes (raw)',       group: 'Hechos', description: 'Órdenes de producción brutas: fechas planificadas, reales y cantidades.' },
  { schema: 'public', name: 'fact_pedidos',        label: 'Pedidos (raw)',       group: 'Hechos', description: 'Pedidos SAP sin transformar: cantidades, precios y fechas de entrega.' },
  { schema: 'public', name: 'fact_entregas',       label: 'Entregas',            group: 'Hechos', description: 'Entregas realizadas vinculadas a pedidos: fecha real, cantidad y monto.' },
  { schema: 'public', name: 'fact_consumos',       label: 'Consumos',            group: 'Hechos', description: 'Consumo de materiales en órdenes de producción: plan vs real, variaciones de costo.' },
  { schema: 'public', name: 'fact_notificaciones', label: 'Notificaciones',      group: 'Hechos', description: 'Notificaciones de producción por material: cantidades notificadas y existencias.' },
  { schema: 'public', name: 'fact_precios',        label: 'Precios',             group: 'Hechos', description: 'Listas de precios por material y organización de ventas con vigencia.' },
  // ── Catálogos (tablas de referencia) ─────────────────────────────────────
  { schema: 'public', name: 'cat_canal',          label: 'Canales de Venta',    group: 'Catálogos', description: 'Catálogo de canales comerciales: código y descripción.' },
  { schema: 'public', name: 'cat_clase_doc',      label: 'Clases de Documento', group: 'Catálogos', description: 'Tipos de documentos SAP: facturas, notas de crédito, etc.' },
  { schema: 'public', name: 'cat_clase_orden',    label: 'Clases de Orden',     group: 'Catálogos', description: 'Tipos de órdenes de producción configurados en SAP.' },
  { schema: 'public', name: 'cat_condicion_pago', label: 'Condic. de Pago',     group: 'Catálogos', description: 'Plazos de pago: contado, 30 días, 60 días, etc.' },
  { schema: 'public', name: 'cat_gpo_cliente',    label: 'Grupos de Cliente',   group: 'Catálogos', description: 'Segmentación de clientes por grupo comercial.' },
  { schema: 'public', name: 'cat_grp_vendedor',   label: 'Grupos de Vendedor',  group: 'Catálogos', description: 'Agrupaciones de la fuerza de ventas.' },
  { schema: 'public', name: 'cat_lista_precio',   label: 'Listas de Precio',    group: 'Catálogos', description: 'Listas de precios activas disponibles en SAP.' },
  { schema: 'public', name: 'cat_ramo',           label: 'Ramos',               group: 'Catálogos', description: 'Sectores de actividad económica de los clientes.' },
  { schema: 'public', name: 'cat_sector',         label: 'Sectores',            group: 'Catálogos', description: 'Clasificación sectorial de materiales y transacciones.' },
  { schema: 'public', name: 'cat_zona_ventas',    label: 'Zonas de Ventas',     group: 'Catálogos', description: 'Territorios comerciales: código y nombre de zona.' },
]

// ── Componente principal ──────────────────────────────────────────────────

export default function SqlExplorer() {
  const [allTables, setAllTables] = useState<TableInfo[]>(SYSTEM_TABLES)
  const [selected, setSelected] = useState<TableInfo | null>(null)
  const [columns, setColumns] = useState<ViewColumn[]>([])
  const [loadingCols, setLoadingCols] = useState(false)
  const [filters, setFilters] = useState<ViewFilter[]>([])
  const [filterErrors, setFilterErrors] = useState<(string | null)[]>([])
  const [limit, setLimit] = useState(50)
  const [result, setResult] = useState<QueryResponse | null>(null)
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [sqlCopied, setSqlCopied] = useState(false)

  // Cargar vistas personalizadas del usuario
  useEffect(() => {
    getLookerViews()
      .then((views) => {
        const custom = views
          .filter((v) => v.is_custom)
          .map<TableInfo>((v) => ({
            schema: 'public', name: v.name,
            label: v.name, group: 'Personalizadas', isCustom: true,
            description: 'Vista personalizada creada por ti desde «Fuentes Looker».',
          }))
        setAllTables(custom.length ? [...SYSTEM_TABLES, ...custom] : SYSTEM_TABLES)
      })
      .catch(() => {})
  }, [])

  // Cargar columnas al cambiar vista
  useEffect(() => {
    if (!selected) return
    setColumns([])
    setFilters([])
    setFilterErrors([])
    setResult(null)
    setRunError(null)
    setLoadingCols(true)
    getAnyTableColumns(selected.schema, selected.name)
      .then(setColumns)
      .catch(() => setColumns([]))
      .finally(() => setLoadingCols(false))
  }, [selected])

  const colMap = Object.fromEntries(columns.map((c) => [c.column_name, c]))

  const buildSql = useCallback(() => {
    if (!selected) return ''
    const table = `${selected.schema}."${selected.name}"`
    const valid = filters.filter((f) => f.column && f.operator && f.value.trim())
    let sql = `SELECT *\nFROM ${table}`
    if (valid.length) {
      const clauses = valid.map((f) => {
        const v = f.value.replace(/'/g, "''")
        const kind = colKind(colMap[f.column]?.data_type ?? 'text')
        // Para booleanos y números no usar comillas
        if (kind === 'boolean') return `"${f.column}" = ${f.value.toLowerCase() === 'true' || f.value === '1' ? 'TRUE' : 'FALSE'}`
        if (kind === 'number')  return `"${f.column}" ${f.operator} ${f.value}`
        if (f.operator === 'ILIKE') return `"${f.column}" ILIKE '%${v}%'`
        return `"${f.column}" ${f.operator} '${v}'`
      })
      sql += '\nWHERE ' + clauses.join('\n  AND ')
    }
    sql += `\nLIMIT ${limit}`
    return sql
  }, [selected, filters, limit, colMap])

  const validate = (): boolean => {
    const errors = filters.map((f) => {
      if (!f.column) return 'Selecciona un campo'
      if (!f.value.trim()) return 'Escribe un valor'
      const kind = colKind(colMap[f.column]?.data_type ?? 'text')
      return validateFilterValue(f.value, kind)
    })
    setFilterErrors(errors)
    return errors.every((e) => e === null)
  }

  const run = async () => {
    if (!validate()) return
    const sql = buildSql()
    if (!sql) return
    setRunning(true)
    setRunError(null)
    setResult(null)
    try { setResult(await executeQuery(sql, limit)) }
    catch (e) { setRunError((e as Error).message) }
    finally { setRunning(false) }
  }

  const copySql = () => {
    navigator.clipboard.writeText(buildSql())
    setSqlCopied(true)
    setTimeout(() => setSqlCopied(false), 2500)
  }

  const addFilter = () => {
    setFilters((f) => [...f, { column: columns[0]?.column_name ?? '', operator: 'ILIKE', value: '' }])
    setFilterErrors((e) => [...e, null])
  }
  const removeFilter = (i: number) => {
    setFilters((f) => f.filter((_, idx) => idx !== i))
    setFilterErrors((e) => e.filter((_, idx) => idx !== i))
  }
  const updateFilter = (i: number, patch: Partial<ViewFilter>) => {
    setFilters((f) => f.map((fl, idx) => {
      if (idx !== i) return fl
      const updated = { ...fl, ...patch }
      // Si cambia el campo, reseteamos el operador al primero válido para ese tipo
      if (patch.column !== undefined) {
        const kind = colKind(colMap[patch.column]?.data_type ?? 'text')
        updated.operator = getOperators(kind)[0].value
        updated.value = ''
      }
      return updated
    }))
    setFilterErrors((e) => e.map((err, idx) => (idx === i ? null : err)))
  }

  const groups: Record<string, TableInfo[]> = {
    Reportes: allTables.filter((t) => t.group === 'Reportes'),
    Dimensiones: allTables.filter((t) => t.group === 'Dimensiones'),
    Hechos: allTables.filter((t) => t.group === 'Hechos'),
    Catálogos: allTables.filter((t) => t.group === 'Catálogos'),
    Personalizadas: allTables.filter((t) => t.group === 'Personalizadas'),
  }

  const sql = buildSql()

  return (
    <div className="w-full space-y-4">

      {/* ── Selector de vista ── */}
      <div className="card p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          ¿Qué datos quieres explorar?
        </p>

        {Object.entries(groups).map(([groupName, items]) =>
          items.length === 0 ? null : (
            <div key={groupName}>
              <div className="flex items-center gap-1.5 mb-1.5">
                {groupName === 'Reportes'       && <BarChart3 size={11} className="text-blue-400" />}
                {groupName === 'Dimensiones'    && <Database  size={11} className="text-violet-400" />}
                {groupName === 'Hechos'         && <BookOpen  size={11} className="text-amber-400" />}
                {groupName === 'Catálogos'      && <Tag       size={11} className="text-slate-400" />}
                {groupName === 'Personalizadas' && <Sparkles  size={11} className="text-emerald-500" />}
                <p className="text-xs font-medium text-slate-400">{groupName}</p>
                <span className="text-xs text-slate-300">({items.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {items.map((t) => {
                  const active = selected?.name === t.name
                  const colorIdle =
                    t.isCustom          ? 'bg-white text-emerald-700 border-emerald-200 hover:border-emerald-400' :
                    groupName === 'Dimensiones' ? 'bg-white text-violet-700 border-violet-100 hover:border-violet-300 hover:text-violet-700' :
                    groupName === 'Hechos'      ? 'bg-white text-amber-700  border-amber-100  hover:border-amber-300  hover:text-amber-700' :
                    groupName === 'Catálogos'   ? 'bg-white text-slate-600  border-slate-200  hover:border-slate-400  hover:text-slate-800' :
                    'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                  return (
                    <button
                      key={t.name}
                      onClick={() => setSelected(t)}
                      title={t.description}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        active ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : colorIdle
                      }`}
                    >
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ),
        )}
      </div>

      {/* ── Sin vista seleccionada ── */}
      {!selected && (
        <div className="card p-12 text-center">
          <div className="inline-flex p-3 bg-slate-50 rounded-xl mb-3">
            <Database size={28} className="text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-500">Selecciona una vista arriba para comenzar</p>
          <p className="text-xs text-slate-400 mt-1">
            Elige entre Reportes, Dimensiones, Hechos, Catálogos o tus vistas personalizadas
          </p>
        </div>
      )}

      {/* ── Layout principal (descripción + filtros + SQL) ── */}
      {selected && (
        <>
          {/* Descripción */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <div className="p-1.5 bg-blue-100 rounded-lg shrink-0">
              <Database size={15} className="text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-blue-800">{selected.label}</span>
                <span className="font-mono text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">
                  {selected.schema}.{selected.name}
                </span>
                {loadingCols && (
                  <span className="text-xs text-blue-400 flex items-center gap-1">
                    <RefreshCw size={11} className="animate-spin" /> cargando campos…
                  </span>
                )}
                {!loadingCols && columns.length > 0 && (
                  <span className="text-xs text-blue-400">{columns.length} campos disponibles</span>
                )}
              </div>
              <p className="text-sm text-blue-700 mt-0.5">{selected.description}</p>
            </div>
          </div>

          {/* Dos columnas en lg+: filtros izquierda / SQL derecha */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

            {/* ── Columna izquierda: Filtros + Límite/Botón ── */}
            <div className="space-y-4">
              {/* Filtros */}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-700">Filtros</h3>
                    <Tooltip text="Limita qué filas se muestran. Sin filtros verás todos los registros hasta el límite.">
                      <HelpCircle size={13} className="text-slate-300 cursor-help" />
                    </Tooltip>
                    <span className="text-xs text-slate-400">— opcional</span>
                  </div>
                  <button
                    onClick={addFilter}
                    disabled={loadingCols || columns.length === 0}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg transition-colors disabled:opacity-40"
                  >
                    <Plus size={12} />
                    Agregar filtro
                  </button>
                </div>

                {filters.length === 0 ? (
                  <div className="py-5 text-center border border-dashed border-slate-200 rounded-lg">
                    <p className="text-sm text-slate-400">Sin filtros — mostrará todos los registros</p>
                    <p className="text-xs text-slate-300 mt-0.5">Haz clic en «Agregar filtro» para acotar los resultados</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filters.map((filter, idx) => (
                      <FilterRow
                        key={idx}
                        filter={filter}
                        columns={columns}
                        colMap={colMap}
                        error={filterErrors[idx] ?? null}
                        onChange={(patch) => updateFilter(idx, patch)}
                        onRemove={() => removeFilter(idx)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Límite + botón */}
              <div className="card p-4 flex items-center gap-4 flex-wrap">
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">
                    Máximo de filas
                    <Tooltip text="Cuántos registros devuelve la consulta. Para tablas grandes usa 100–500.">
                      <HelpCircle size={12} className="inline ml-1 text-slate-300 cursor-help" />
                    </Tooltip>
                  </label>
                  <select
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                  >
                    {LIMIT_OPTIONS.map((n) => (
                      <option key={n} value={n}>{n} filas</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={run}
                    disabled={running}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                  >
                    {running
                      ? <><RefreshCw size={15} className="animate-spin" />Consultando…</>
                      : <><Play size={15} />Ver datos</>
                    }
                  </button>
                </div>
                <p className="text-xs text-slate-400 self-end pb-0.5">Solo lectura · no modifica la BD</p>
              </div>
            </div>

            {/* ── Columna derecha: SQL siempre visible ── */}
            <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-700 h-full min-h-[200px]">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-300">SQL generado</span>
                  <span className="hidden sm:flex items-center gap-1 text-xs text-slate-500">
                    <Info size={11} />
                    Pégalo en Looker Studio → «Consulta personalizada»
                  </span>
                </div>
                <button
                  onClick={copySql}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    sqlCopied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                  }`}
                >
                  {sqlCopied ? <Check size={12} /> : <Copy size={12} />}
                  {sqlCopied ? '¡Copiado!' : 'Copiar SQL'}
                </button>
              </div>
              <pre className="px-4 py-3 text-green-400 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre">
                {sql || '-- Selecciona una vista y configura los filtros'}
              </pre>
            </div>
          </div>

          {/* ── Error de ejecución ── */}
          {runError && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
              <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-700">No se pudo ejecutar la consulta</p>
                <p className="text-xs text-red-600 mt-1 font-mono leading-relaxed">{runError}</p>
                <p className="text-xs text-red-500 mt-2">
                  Sugerencia: verifica que los valores de los filtros correspondan al tipo de dato del campo.
                </p>
              </div>
            </div>
          )}

          {/* ── Resultados — ancho completo ── */}
          {result && <ResultsPanel result={result} tableName={selected.label} />}
        </>
      )}
    </div>
  )
}

// ── FilterRow con validación por tipo ─────────────────────────────────────

function FilterRow({
  filter, columns, colMap, error, onChange, onRemove,
}: {
  filter: ViewFilter
  columns: ViewColumn[]
  colMap: Record<string, ViewColumn>
  error: string | null
  onChange: (p: Partial<ViewFilter>) => void
  onRemove: () => void
}) {
  const kind = colKind(colMap[filter.column]?.data_type ?? 'text')
  const operators = getOperators(kind)
  const activeOp = operators.find((o) => o.value === filter.operator) ?? operators[0]

  return (
    <div className={`border rounded-lg p-3 space-y-2 ${error ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
        {/* Campo */}
        <div>
          <p className="text-xs text-slate-500 mb-1">Campo</p>
          <select
            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={filter.column}
            onChange={(e) => onChange({ column: e.target.value })}
          >
            <option value="">Selecciona…</option>
            {columns.map((c) => (
              <option key={c.column_name} value={c.column_name}>
                {c.column_name} — {c.data_type}
              </option>
            ))}
          </select>
        </div>
        {/* Condición */}
        <div>
          <p className="text-xs text-slate-500 mb-1">Condición</p>
          <select
            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={filter.operator}
            onChange={(e) => onChange({ operator: e.target.value })}
          >
            {operators.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <button
          onClick={onRemove}
          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-100 rounded-lg transition-colors mb-0.5"
          title="Eliminar filtro"
        >
          <X size={14} />
        </button>
      </div>

      {/* Valor */}
      <div>
        <p className="text-xs text-slate-500 mb-1">
          Valor — <span className="text-slate-400">{activeOp.hint}</span>
        </p>
        {/* Booleano: dropdown */}
        {kind === 'boolean' ? (
          <select
            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={filter.value}
            onChange={(e) => onChange({ value: e.target.value })}
          >
            <option value="">Selecciona…</option>
            <option value="true">Sí / Verdadero (true)</option>
            <option value="false">No / Falso (false)</option>
          </select>
        ) : kind === 'date' ? (
          <input
            type="date"
            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={filter.value}
            onChange={(e) => onChange({ value: e.target.value })}
          />
        ) : (
          <input
            type={kind === 'number' ? 'number' : 'text'}
            className={`w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 ${
              error ? 'border-red-300' : 'border-slate-200'
            }`}
            placeholder={activeOp.placeholder}
            value={filter.value}
            onChange={(e) => onChange({ value: e.target.value })}
          />
        )}
        {error && (
          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
            <AlertCircle size={11} /> {error}
          </p>
        )}
      </div>
    </div>
  )
}

// ── ResultsPanel ──────────────────────────────────────────────────────────

function ResultsPanel({ result, tableName }: { result: QueryResponse; tableName: string }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-4 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
        <span className="text-xs font-semibold text-slate-600">{tableName}</span>
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <Rows size={12} />
          {result.row_count} {result.row_count === 1 ? 'fila' : 'filas'}
          {result.truncated && <span className="text-amber-600 font-medium ml-1">(truncado)</span>}
        </span>
        <span className="flex items-center gap-1 text-xs text-slate-400">
          <Clock size={12} />
          {result.execution_time_ms} ms
        </span>
      </div>

      {result.row_count === 0 ? (
        <div className="py-10 text-center">
          <p className="text-slate-500 text-sm font-medium">Sin resultados</p>
          <p className="text-slate-400 text-xs mt-1">Los filtros no coinciden con ningún registro.</p>
        </div>
      ) : (
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-100">
              <tr>
                {result.columns.map((col) => (
                  <th key={col} className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, ri) => (
                <tr key={ri} className={`border-b border-slate-50 hover:bg-blue-50/30 transition-colors ${ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-1.5 text-slate-600 whitespace-nowrap max-w-xs truncate" title={cell === null ? '' : String(cell)}>
                      {cell === null ? <span className="text-slate-300 italic">—</span> : String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.truncated && (
        <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 text-xs text-amber-700 flex items-center gap-1.5">
          <Info size={12} />
          Solo los primeros {result.row_count} registros. Aumenta el límite si necesitas ver más.
        </div>
      )}
    </div>
  )
}

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-52 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg shadow-xl pointer-events-none leading-relaxed">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </span>
      )}
    </span>
  )
}

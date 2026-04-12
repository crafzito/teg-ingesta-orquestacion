import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  Card, CardBody, Tabs, Tab, Chip, Button, Spinner,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Progress, Tooltip, useDisclosure,
} from '@heroui/react'
import {
  Activity, PlayCircle, RefreshCw, CheckCircle2, XCircle,
  AlertTriangle, Clock, ChevronDown, ChevronRight, FileText,
} from 'lucide-react'
import { formatDistanceToNow, parseISO, format } from 'date-fns'
import { es } from 'date-fns/locale'

import { PageHeader } from '../components/ui/PageHeader'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { useEtlMonitor, useEtlRun } from '../api/hooks/useEtlMonitor'
import type {
  EtlBatchItem,
  EtlBatchFileItem,
  EtlSourceStatus,
  EtlExecutionItem,
} from '../types/etl'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ASCII_DASH = '-'
const MONITOR_REFRESH_MS = 5_000

function sanitizeDisplayText(value: string | null | undefined, fallback = ASCII_DASH): string {
  if (value == null) return fallback

  const normalized = value
    .replace(/\\u2014|\\u2013|\u2014|\u2013|ÔÇö|â€”|â€“/g, ASCII_DASH)
    .replace(/\\u2026|\u2026/g, '...')
    .replace(/\\u2192|\u2192|ÔåÆ|â†’/g, '->')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || fallback
}

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return ASCII_DASH
  try {
    return format(parseISO(value), 'dd/MM/yyyy HH:mm', { locale: es })
  } catch {
    return sanitizeDisplayText(value)
  }
}

function fmtRelative(value: string | null | undefined): string {
  if (!value) return ''
  try {
    return formatDistanceToNow(parseISO(value), { addSuffix: true, locale: es })
  } catch {
    return ''
  }
}

function fmtNumber(value: number): string {
  return new Intl.NumberFormat('es-VE').format(value)
}

function shortBatchId(id: string | null | undefined): string {
  if (!id) return ASCII_DASH
  return id.length > 12 ? `...${id.slice(-12)}` : sanitizeDisplayText(id)
}

type StatusColor = 'success' | 'danger' | 'primary' | 'warning' | 'default'

function statusColor(status: string): StatusColor {
  switch (status) {
    case 'SUCCESS': return 'success'
    case 'FAILED': return 'danger'
    case 'PARTIAL_FAILED': return 'warning'
    case 'RUNNING':
    case 'PROCESSING': return 'primary'
    case 'RECEIVED': return 'primary'
    case 'SKIPPED':
    case 'IGNORED': return 'default'
    default: return 'default'
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'SUCCESS': return 'Exitoso'
    case 'FAILED': return 'Fallido'
    case 'PARTIAL_FAILED': return 'Parcial'
    case 'RUNNING':
    case 'PROCESSING': return 'En proceso'
    case 'RECEIVED': return 'Recibido'
    case 'SKIPPED': return 'Sin cambios'
    case 'IGNORED': return 'Ignorado'
    default: return status
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EtlMonitorPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useEtlMonitor()
  const etlRun = useEtlRun()
  const confirmModal = useDisclosure()

  const summary = data?.summary
  const currentBatches = data?.current_batches ?? []
  const recentBatches = data?.recent_batches ?? []
  const sourceStatus = data?.source_status ?? []
  const recentExecutions = data?.recent_executions ?? []
  const isRunning = (currentBatches.length > 0) || (summary?.running_batches ?? 0) > 0

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refetch()
    }, MONITOR_REFRESH_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [refetch])

  const handleRunEtl = useCallback(() => {
    etlRun.mutate({})
    confirmModal.onClose()
  }, [etlRun, confirmModal])

  // Combine current + recent for batches tab
  const allBatches = useMemo(() => {
    const ids = new Set<string>()
    const result: EtlBatchItem[] = []
    for (const b of [...currentBatches, ...recentBatches]) {
      if (!ids.has(b.batch_id)) {
        ids.add(b.batch_id)
        result.push(b)
      }
    }
    return result
  }, [currentBatches, recentBatches])

  // Header actions — stacks vertically on mobile
  const headerActions = (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
      <div className="flex items-center gap-2 text-xs sm:text-sm text-default-400 justify-center sm:justify-start">
        {isFetching && <Spinner size="sm" color="primary" />}
        {data && (
          <Tooltip content={fmtDateTime(data.generated_at)}>
            <span className="cursor-default whitespace-nowrap">
              Actualizado {fmtRelative(data.generated_at)}
            </span>
          </Tooltip>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="flat"
          className="flex-1 sm:flex-none"
          startContent={<RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />}
          onPress={() => refetch()}
        >
          Actualizar
        </Button>
        <Button
          size="sm"
          className="flex-1 sm:flex-none text-white font-semibold"
          style={{ backgroundColor: '#FF4E00' }}
          startContent={<PlayCircle className={`h-4 w-4 ${isRunning ? 'animate-pulse' : ''}`} />}
          isDisabled={isRunning || etlRun.isPending}
          onPress={confirmModal.onOpen}
        >
          {etlRun.isPending ? 'Iniciando...' : isRunning ? 'ETL en proceso' : 'Ejecutar ETL'}
        </Button>
      </div>
    </div>
  )

  if (isLoading) return <LoadingSpinner />

  if (isError) {
    return (
      <div>
        <PageHeader title="Monitor ETL" description="Seguimiento del pipeline de carga de datos" />
        <div className="rounded-xl bg-danger-50 border border-danger-200 p-3 sm:p-4 text-xs sm:text-sm text-danger">
          No se pudo cargar el monitor ETL: {(error as Error)?.message ?? 'Error desconocido'}
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Monitor ETL"
        description="Seguimiento del pipeline de carga de datos"
        actions={headerActions}
      />

      {/* ETL run feedback */}
      {etlRun.isSuccess && (
        <div className="mb-3 sm:mb-4 rounded-xl bg-success-50 border border-success-200 p-2 sm:p-3 text-xs sm:text-sm text-success-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <span>{etlRun.data?.message ?? 'ETL iniciado correctamente'}</span>
          <Button size="sm" variant="light" onPress={() => etlRun.reset()}>Cerrar</Button>
        </div>
      )}
      {etlRun.isError && (
        <div className="mb-3 sm:mb-4 rounded-xl bg-danger-50 border border-danger-200 p-2 sm:p-3 text-xs sm:text-sm text-danger flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <span>{(etlRun.error as Error)?.message ?? 'Error al iniciar ETL'}</span>
          <Button size="sm" variant="light" color="danger" onPress={() => etlRun.reset()}>Cerrar</Button>
        </div>
      )}

      {/* Database warning */}
      {data && !data.database_available && (
        <div className="mb-3 sm:mb-4 rounded-xl bg-warning-50 border border-warning-200 p-2 sm:p-3 text-xs sm:text-sm text-warning-700">
          La base de datos no esta disponible.
          {data.database_error ? ` Detalle: ${sanitizeDisplayText(data.database_error, 'Sin detalle')}` : ''}
        </div>
      )}

      {/* Summary KPI cards — 1 col mobile, 2 col tablet, 4 col desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <SummaryCard
          icon={<Activity className="h-5 w-5" />}
          label="Estado"
          value={isRunning ? 'Procesando' : (summary?.failed_batches ?? 0) > 0 ? 'Con fallos' : 'En espera'}
          color={isRunning ? 'primary' : (summary?.failed_batches ?? 0) > 0 ? 'danger' : 'success'}
          hint={data ? `Actualizado ${fmtRelative(data.generated_at)}` : ''}
        />
        <SummaryCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Lotes exitosos"
          value={fmtNumber(summary?.successful_batches ?? 0)}
          color="success"
          hint={`${fmtNumber(summary?.running_batches ?? 0)} activo(s)`}
        />
        <SummaryCard
          icon={<XCircle className="h-5 w-5" />}
          label="Lotes fallidos"
          value={fmtNumber(summary?.failed_batches ?? 0)}
          color={(summary?.failed_batches ?? 0) > 0 ? 'danger' : 'default'}
          hint={summary?.last_batch_status ? `Ultimo: ${statusLabel(summary.last_batch_status)}` : 'Sin datos'}
        />
        <SummaryCard
          icon={<FileText className="h-5 w-5" />}
          label="Archivos totales"
          value={fmtNumber(summary?.total_files ?? 0)}
          color="default"
          hint={`${fmtNumber(summary?.csv_files ?? 0)} CSV, ${fmtNumber(summary?.xlsx_files ?? 0)} XLSX`}
        />
      </div>

      {/* Tabs — full width, scrollable on mobile */}
      <Tabs
        aria-label="ETL Monitor tabs"
        color="primary"
        variant="underlined"
        classNames={{
          tabList: 'mb-3 sm:mb-4 overflow-x-auto scrollbar-hide',
          tab: 'min-w-fit',
        }}
      >
        {/* Tab 1: Batches recientes */}
        <Tab
          key="batches"
          title={
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="text-xs sm:text-sm whitespace-nowrap">Batches Recientes</span>
              {currentBatches.length > 0 && (
                <Chip size="sm" color="primary" variant="flat">{currentBatches.length}</Chip>
              )}
            </div>
          }
        >
          {allBatches.length === 0 ? (
            <EmptyState message="No hay lotes registrados aun." />
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {allBatches.map((batch) => (
                <BatchCard
                  key={batch.batch_id}
                  batch={batch}
                  isActive={currentBatches.some((b) => b.batch_id === batch.batch_id)}
                />
              ))}
            </div>
          )}
        </Tab>

        {/* Tab 2: Estado por fuente */}
        <Tab
          key="sources"
          title={
            <div className="flex items-center gap-1.5 sm:gap-2">
              <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="text-xs sm:text-sm whitespace-nowrap">Estado por Fuente</span>
            </div>
          }
        >
          {sourceStatus.length === 0 ? (
            <EmptyState message="No hay datos de estado por fuente." />
          ) : (
            <SourceStatusTable data={sourceStatus} />
          )}
        </Tab>

        {/* Tab 3: Historial */}
        <Tab
          key="history"
          title={
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="text-xs sm:text-sm whitespace-nowrap">Historial de Ejecuciones</span>
            </div>
          }
        >
          {recentExecutions.length === 0 ? (
            <EmptyState message="No hay ejecuciones registradas." />
          ) : (
            <ExecutionsTable data={recentExecutions} />
          )}
        </Tab>
      </Tabs>

      {/* Confirm modal — responsive sizing */}
      <Modal
        isOpen={confirmModal.isOpen}
        onOpenChange={confirmModal.onOpenChange}
        size="sm"
        classNames={{
          base: 'mx-2 sm:mx-auto',
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1 text-base sm:text-lg">Confirmar ejecucion ETL</ModalHeader>
              <ModalBody>
                <p className="text-xs sm:text-sm text-default-600">
                  Esto iniciara el pipeline de carga de datos. Los archivos en la carpeta
                  de entrada seran procesados e insertados en la base de datos.
                </p>
              </ModalBody>
              <ModalFooter className="flex flex-col-reverse sm:flex-row gap-2">
                <Button variant="flat" className="w-full sm:w-auto" onPress={onClose}>Cancelar</Button>
                <Button className="w-full sm:w-auto text-white font-semibold" style={{ backgroundColor: '#FF4E00' }} onPress={handleRunEtl}>Ejecutar</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryCard({
  icon,
  label,
  value,
  color,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  color: 'primary' | 'success' | 'danger' | 'warning' | 'default'
  hint: string
}) {
  const colorClasses: Record<string, string> = {
    primary: 'bg-[#091B6B]/10 text-[#091B6B]',
    success: 'bg-[#00972E]/10 text-[#00972E]',
    danger: 'bg-danger/10 text-danger',
    warning: 'bg-[#FF4E00]/10 text-[#FF4E00]',
    default: 'bg-[#091B6B]/10 text-[#091B6B]',
  }

  return (
    <Card shadow="sm" className="border-none">
      <CardBody className="p-3 sm:p-4 lg:p-5">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm text-default-500">{label}</p>
            <p className="mt-0.5 sm:mt-1 text-xl sm:text-2xl font-bold text-foreground">{value}</p>
            <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-default-400 truncate">{hint}</p>
          </div>
          <div className={`ml-3 sm:ml-4 flex-shrink-0 p-2 sm:p-3 rounded-xl ${colorClasses[color]}`}>
            {icon}
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

function BatchCard({ batch, isActive }: { batch: EtlBatchItem; isActive: boolean }) {
  const [expanded, setExpanded] = useState(isActive)

  return (
    <Card
      shadow="sm"
      className={`border ${isActive ? 'border-[#091B6B]/30 bg-[#091B6B]/5' : 'border-default-200'}`}
    >
      <CardBody className="p-0">
        {/* Header row */}
        <button
          className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 text-left hover:bg-default-50 transition-colors rounded-t-lg gap-2 sm:gap-3"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {expanded
              ? <ChevronDown className="h-4 w-4 text-default-400 flex-shrink-0" />
              : <ChevronRight className="h-4 w-4 text-default-400 flex-shrink-0" />
            }
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <Tooltip content={batch.batch_id}>
                  <span className="font-semibold text-sm sm:text-base text-foreground">
                    Lote {shortBatchId(batch.batch_id)}
                  </span>
                </Tooltip>
                <Chip size="sm" color={statusColor(batch.status)} variant="flat" className="whitespace-nowrap">
                  {statusLabel(batch.status)}
                </Chip>
                <Chip size="sm" variant="flat" color="default" className="whitespace-nowrap">{batch.trigger_type}</Chip>
                {isActive && (
                  <Chip size="sm" color="primary" variant="dot">Activo</Chip>
                )}
              </div>
              <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-default-400">
                Inicio: {fmtDateTime(batch.started_at)}
                {batch.finished_at ? ` | Fin: ${fmtDateTime(batch.finished_at)}` : ''}
              </p>
            </div>
          </div>

          {/* Metrics — visible as inline pills on sm+, compact grid on mobile */}
          <div className="flex items-center gap-3 sm:gap-4 text-sm text-default-500 pl-6 sm:pl-0">
            <MetricPill label="Archivos" value={fmtNumber(batch.file_count)} />
            <MetricPill label="Leidas" value={fmtNumber(batch.rows_read_total)} />
            <MetricPill label="Insertadas" value={fmtNumber(batch.rows_inserted_total)} />
            <MetricPill label="Actualizadas" value={fmtNumber(batch.rows_updated_total)} />
          </div>
        </button>

        {/* Error message */}
        {batch.error_message && (
          <div className="mx-2 sm:mx-4 mb-2 rounded-lg bg-danger-50 border border-danger-100 px-2 sm:px-3 py-2 text-[11px] sm:text-xs text-danger break-words">
            {sanitizeDisplayText(batch.error_message)}
          </div>
        )}

        {/* Expanded files */}
        {expanded && (
          <div className="border-t border-default-100 p-2 sm:p-4">
            {batch.files.length === 0 ? (
              <p className="text-xs sm:text-sm text-default-400 py-2">Este lote no tiene archivos visibles.</p>
            ) : (
              <>
                {/* Card-based layout for mobile */}
                <div className="block sm:hidden space-y-2">
                  {batch.files.map((file) => (
                    <BatchFileCard key={file.id} file={file} />
                  ))}
                </div>
                {/* Table layout for sm+ */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table
                    aria-label={`Archivos del lote ${batch.batch_id}`}
                    isCompact
                    isStriped
                    removeWrapper
                    classNames={{ th: 'text-xs', td: 'text-xs sm:text-sm', table: 'min-w-[700px]' }}
                  >
                    <TableHeader>
                      <TableColumn>Archivo</TableColumn>
                      <TableColumn>Fuente</TableColumn>
                      <TableColumn>Estado</TableColumn>
                      <TableColumn align="end">Leidas</TableColumn>
                      <TableColumn align="end">Insertadas</TableColumn>
                      <TableColumn align="end">Actualizadas</TableColumn>
                      <TableColumn align="end">Rechazadas</TableColumn>
                      <TableColumn>Error</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {batch.files.map((file) => (
                        <TableRow key={file.id}>
                          <TableCell>
                            <span className="font-medium whitespace-nowrap">{file.filename}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-default-500 whitespace-nowrap">{sanitizeDisplayText(file.source_key)}</span>
                          </TableCell>
                          <TableCell>
                            <Chip size="sm" color={statusColor(file.status)} variant="flat" className="whitespace-nowrap">
                              {statusLabel(file.status)}
                            </Chip>
                          </TableCell>
                          <TableCell>
                            <span className="tabular-nums whitespace-nowrap">{file.rows_read > 0 ? fmtNumber(file.rows_read) : ASCII_DASH}</span>
                          </TableCell>
                          <TableCell>
                            <span className="tabular-nums whitespace-nowrap">{fmtNumber(file.rows_inserted)}</span>
                          </TableCell>
                          <TableCell>
                            <span className="tabular-nums whitespace-nowrap">{fmtNumber(file.rows_updated)}</span>
                          </TableCell>
                          <TableCell>
                            <span className="tabular-nums whitespace-nowrap">{fmtNumber(file.rows_rejected)}</span>
                          </TableCell>
                          <TableCell>
                            {file.error_message ? (
                              <Tooltip content={sanitizeDisplayText(file.error_message, 'Sin detalle')}>
                                <span className="text-danger text-xs cursor-help truncate max-w-[160px] inline-block">
                                  {sanitizeDisplayText(file.error_message)}
                                </span>
                              </Tooltip>
                            ) : (
                              <span className="text-default-300">{ASCII_DASH}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  )
}

/** Mobile card layout for a single batch file — replaces table row on xs screens */
function BatchFileCard({ file }: { file: EtlBatchFileItem }) {
  return (
    <div className="rounded-lg border border-default-100 bg-default-50 p-2.5">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="font-medium text-xs text-foreground truncate">{file.filename}</span>
        <Chip size="sm" color={statusColor(file.status)} variant="flat" className="whitespace-nowrap flex-shrink-0">
          {statusLabel(file.status)}
        </Chip>
      </div>
      {file.source_key && (
        <p className="text-[11px] text-default-400 mb-1.5">Fuente: {file.source_key}</p>
      )}
      <div className="grid grid-cols-4 gap-1 text-center">
        <div>
          <p className="text-[10px] uppercase text-default-400">Leidas</p>
          <p className="text-xs font-semibold tabular-nums">{file.rows_read > 0 ? fmtNumber(file.rows_read) : ASCII_DASH}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-default-400">Insertadas</p>
          <p className="text-xs font-semibold tabular-nums">{fmtNumber(file.rows_inserted)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-default-400">Actual.</p>
          <p className="text-xs font-semibold tabular-nums">{fmtNumber(file.rows_updated)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-default-400">Rech.</p>
          <p className="text-xs font-semibold tabular-nums">{fmtNumber(file.rows_rejected)}</p>
        </div>
      </div>
      {file.error_message && (
        <div className="mt-1.5 rounded bg-danger-50 px-2 py-1 text-[11px] text-danger break-words">
          {sanitizeDisplayText(file.error_message)}
        </div>
      )}
    </div>
  )
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] sm:text-[11px] uppercase tracking-wide text-default-400">{label}</p>
      <p className="text-xs sm:text-sm font-semibold text-foreground tabular-nums">{value}</p>
    </div>
  )
}

function SourceStatusTable({ data }: { data: EtlSourceStatus[] }) {
  return (
    <>
      {/* Card-based layout for mobile */}
      <div className="block sm:hidden space-y-2">
        {data.map((row) => {
          const pct = parseFloat(row.pct_sin_cambios) || 0
          return (
            <Card key={row.archivo} shadow="sm" className="border-none">
              <CardBody className="p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-medium text-xs text-foreground truncate">{row.archivo}</span>
                  <Chip size="sm" color={statusColor(row.estado)} variant="flat" className="whitespace-nowrap flex-shrink-0">
                    {statusLabel(row.estado)}
                  </Chip>
                </div>
                <p className="text-[11px] text-default-400 mb-2">
                  Ultima carga: {fmtDateTime(row.ultima_carga)}
                </p>
                <div className="grid grid-cols-4 gap-1 text-center mb-2">
                  <div>
                    <p className="text-[10px] uppercase text-default-400">Leidas</p>
                    <p className="text-xs font-semibold tabular-nums">{fmtNumber(row.leidas)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-default-400">Insertadas</p>
                    <p className="text-xs font-semibold tabular-nums">{fmtNumber(row.nuevas)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-default-400">Actual.</p>
                    <p className="text-xs font-semibold tabular-nums">{fmtNumber(row.actualizadas)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-default-400">Rech.</p>
                    <p className="text-xs font-semibold tabular-nums">{fmtNumber(row.rechazadas)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-default-400 whitespace-nowrap">Sin cambios:</span>
                  <Progress
                    size="sm"
                    value={pct}
                    color={pct > 90 ? 'success' : pct > 50 ? 'warning' : 'primary'}
                    className="flex-1"
                    aria-label={`${sanitizeDisplayText(row.pct_sin_cambios)} sin cambios`}
                  />
                  <span className="text-[11px] text-default-400 tabular-nums whitespace-nowrap">{sanitizeDisplayText(row.pct_sin_cambios)}</span>
                </div>
              </CardBody>
            </Card>
          )
        })}
      </div>

      {/* Table layout for sm+ */}
      <div className="hidden sm:block overflow-x-auto">
        <Table
          aria-label="Estado por fuente"
          isStriped
          isCompact
          classNames={{ wrapper: 'shadow-sm', table: 'min-w-[800px]' }}
        >
          <TableHeader>
            <TableColumn>Archivo</TableColumn>
            <TableColumn>Estado</TableColumn>
            <TableColumn>Ultima Carga</TableColumn>
            <TableColumn align="end">Leidas</TableColumn>
            <TableColumn align="end">Insertadas</TableColumn>
            <TableColumn align="end">Actualizadas</TableColumn>
            <TableColumn align="end">Sin Cambios</TableColumn>
            <TableColumn align="end">Rechazadas</TableColumn>
            <TableColumn align="center">% Sin Cambios</TableColumn>
          </TableHeader>
          <TableBody>
            {data.map((row) => {
              const pct = parseFloat(row.pct_sin_cambios) || 0
              return (
                <TableRow key={row.archivo}>
                  <TableCell>
                    <span className="font-medium whitespace-nowrap">{row.archivo}</span>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" color={statusColor(row.estado)} variant="flat" className="whitespace-nowrap">
                      {statusLabel(row.estado)}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <span className="text-default-500 whitespace-nowrap">{fmtDateTime(row.ultima_carga)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="tabular-nums whitespace-nowrap">{fmtNumber(row.leidas)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="tabular-nums whitespace-nowrap">{fmtNumber(row.nuevas)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="tabular-nums whitespace-nowrap">{fmtNumber(row.actualizadas)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="tabular-nums whitespace-nowrap">{fmtNumber(row.sin_cambios)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="tabular-nums whitespace-nowrap">{fmtNumber(row.rechazadas)}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-center gap-1">
                      <Progress
                        size="sm"
                        value={pct}
                        color={pct > 90 ? 'success' : pct > 50 ? 'warning' : 'primary'}
                        className="max-w-[80px]"
                        aria-label={`${sanitizeDisplayText(row.pct_sin_cambios)} sin cambios`}
                      />
                      <span className="text-xs text-default-400 tabular-nums">{sanitizeDisplayText(row.pct_sin_cambios)}</span>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </>
  )
}

function ExecutionsTable({ data }: { data: EtlExecutionItem[] }) {
  return (
    <>
      {/* Card-based layout for mobile */}
      <div className="block sm:hidden space-y-2">
        {data.map((exec) => (
          <Card key={exec.id} shadow="sm" className="border-none">
            <CardBody className="p-3">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono text-[11px] text-default-400">#{exec.id}</span>
                  <span className="font-medium text-xs text-foreground truncate">{exec.source_key}</span>
                </div>
                <Chip size="sm" color={statusColor(exec.status)} variant="flat" className="whitespace-nowrap flex-shrink-0">
                  {statusLabel(exec.status)}
                </Chip>
              </div>
              <p className="text-[11px] text-default-400 mb-1.5">
                Batch: {shortBatchId(exec.batch_id)}
              </p>
              <p className="text-[11px] text-default-400 mb-2">
                {fmtDateTime(exec.started_at)}
                {exec.finished_at ? ` -> ${fmtDateTime(exec.finished_at)}` : ''}
              </p>
              <div className="grid grid-cols-4 gap-1 text-center">
                <div>
                  <p className="text-[10px] uppercase text-default-400">Leidas</p>
                  <p className="text-xs font-semibold tabular-nums">{fmtNumber(exec.rows_read)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-default-400">Insertadas</p>
                  <p className="text-xs font-semibold tabular-nums">{fmtNumber(exec.rows_inserted)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-default-400">Actual.</p>
                  <p className="text-xs font-semibold tabular-nums">{fmtNumber(exec.rows_updated)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-default-400">Rech.</p>
                  <p className="text-xs font-semibold tabular-nums">{fmtNumber(exec.rows_rejected)}</p>
                </div>
              </div>
              {exec.error_message && (
                <div className="mt-1.5 rounded bg-danger-50 px-2 py-1 text-[11px] text-danger break-words">
                  <AlertTriangle className="h-3 w-3 inline mr-1" />
                  {sanitizeDisplayText(exec.error_message)}
                </div>
              )}
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Table layout for sm+ */}
      <div className="hidden sm:block overflow-x-auto">
        <Table
          aria-label="Historial de ejecuciones"
          isStriped
          isCompact
          classNames={{ wrapper: 'shadow-sm', table: 'min-w-[900px]' }}
        >
          <TableHeader>
            <TableColumn>ID</TableColumn>
            <TableColumn>Batch</TableColumn>
            <TableColumn>Fuente</TableColumn>
            <TableColumn>Estado</TableColumn>
            <TableColumn>Inicio</TableColumn>
            <TableColumn>Fin</TableColumn>
            <TableColumn align="end">Leidas</TableColumn>
            <TableColumn align="end">Insertadas</TableColumn>
            <TableColumn align="end">Actualizadas</TableColumn>
            <TableColumn align="end">Rechazadas</TableColumn>
            <TableColumn>Error</TableColumn>
          </TableHeader>
          <TableBody>
            {data.map((exec) => (
              <TableRow key={exec.id}>
                <TableCell>
                  <span className="font-mono text-xs whitespace-nowrap">{exec.id}</span>
                </TableCell>
                <TableCell>
                  <Tooltip content={sanitizeDisplayText(exec.batch_id, 'Sin batch')}>
                    <span className="text-xs text-default-500 whitespace-nowrap">{shortBatchId(exec.batch_id)}</span>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <span className="font-medium whitespace-nowrap">{exec.source_key}</span>
                </TableCell>
                <TableCell>
                  <Chip size="sm" color={statusColor(exec.status)} variant="flat" className="whitespace-nowrap">
                    {statusLabel(exec.status)}
                  </Chip>
                </TableCell>
                <TableCell>
                  <span className="text-default-500 text-xs whitespace-nowrap">{fmtDateTime(exec.started_at)}</span>
                </TableCell>
                <TableCell>
                  <span className="text-default-500 text-xs whitespace-nowrap">{fmtDateTime(exec.finished_at)}</span>
                </TableCell>
                <TableCell>
                  <span className="tabular-nums whitespace-nowrap">{fmtNumber(exec.rows_read)}</span>
                </TableCell>
                <TableCell>
                  <span className="tabular-nums whitespace-nowrap">{fmtNumber(exec.rows_inserted)}</span>
                </TableCell>
                <TableCell>
                  <span className="tabular-nums whitespace-nowrap">{fmtNumber(exec.rows_updated)}</span>
                </TableCell>
                <TableCell>
                  <span className="tabular-nums whitespace-nowrap">{fmtNumber(exec.rows_rejected)}</span>
                </TableCell>
                <TableCell>
                  {exec.error_message ? (
                    <Tooltip content={sanitizeDisplayText(exec.error_message, 'Sin detalle')}>
                      <Chip size="sm" color="danger" variant="flat" className="cursor-help whitespace-nowrap">
                        <AlertTriangle className="h-3 w-3 mr-1 inline" />
                        Ver error
                      </Chip>
                    </Tooltip>
                  ) : (
                    <span className="text-default-300">{ASCII_DASH}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card shadow="none" className="border border-dashed border-default-200">
      <CardBody className="py-8 sm:py-12 text-center">
        <p className="text-xs sm:text-sm text-default-400">{message}</p>
      </CardBody>
    </Card>
  )
}

import { useState, useMemo, useCallback } from 'react'
import {
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Pagination, Input, Spinner, Chip, Select, SelectItem, Card, CardBody,
} from '@heroui/react'
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

interface Column<T> {
  key: keyof T
  label: string
  render?: (value: T[keyof T], row: T) => React.ReactNode
  align?: 'start' | 'center' | 'end'
  sortable?: boolean
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  pageSize?: number
  searchable?: boolean
  title?: string
  isLoading?: boolean
}

export function DataTable<T extends object>({
  data,
  columns,
  pageSize = 20,
  searchable = true,
  title,
  isLoading,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sortDescriptor, setSortDescriptor] = useState<{ column: string; direction: 'ascending' | 'descending' }>({ column: '', direction: 'ascending' })

  const filtered = useMemo(() => {
    if (!search) return data
    const lower = search.toLowerCase()
    return data.filter((row) =>
      columns.some((col) => {
        const value = (row as Record<string, unknown>)[String(col.key)]
        return String(value ?? '').toLowerCase().includes(lower)
      })
    )
  }, [data, search, columns])

  const sorted = useMemo(() => {
    if (!sortDescriptor.column) return filtered
    const col = sortDescriptor.column
    return [...filtered].sort((a, b) => {
      const av = (a as Record<string, unknown>)[col]
      const bv = (b as Record<string, unknown>)[col]
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv))
      return sortDescriptor.direction === 'ascending' ? cmp : -cmp
    })
  }, [filtered, sortDescriptor])

  const totalPages = Math.ceil(sorted.length / pageSize)
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize)

  const renderCell = useCallback((item: T, columnKey: string) => {
    const col = columns.find((c) => String(c.key) === columnKey)
    const record = item as Record<string, unknown>
    if (!col) return String(record[columnKey] ?? '-')
    if (col.render) return col.render(item[col.key], item)
    return String(item[col.key] ?? '-')
  }, [columns])

  const topContent = (
    <div className="flex flex-col gap-3 px-1 md:flex-row md:items-center md:justify-between">
      {title && <h3 className="text-lg font-semibold text-foreground">{title}</h3>}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        {searchable && (
          <Input
            isClearable
            className="w-full sm:w-64"
            placeholder="Buscar..."
            size="sm"
            variant="bordered"
            startContent={<Search className="h-4 w-4 text-default-400" />}
            value={search}
            onClear={() => { setSearch(''); setPage(1) }}
            onValueChange={(v) => { setSearch(v); setPage(1) }}
          />
        )}
        <Chip size="sm" variant="flat" color="default" className="self-start sm:self-auto">
          {sorted.length} registros
        </Chip>
      </div>
    </div>
  )

  const sortableColumns = columns.filter((c) => c.sortable !== false)

  const mobileSort = (
    <div className="flex items-center gap-2 px-1 md:hidden">
      <Select
        aria-label="Ordenar por"
        size="sm"
        variant="bordered"
        className="w-full"
        placeholder="Ordenar por..."
        selectedKeys={sortDescriptor.column ? [sortDescriptor.column] : []}
        onSelectionChange={(keys) => {
          const key = Array.from(keys)[0] as string | undefined
          setSortDescriptor({
            column: key ?? '',
            direction: sortDescriptor.direction,
          })
          setPage(1)
        }}
      >
        {sortableColumns.map((col) => (
          <SelectItem key={String(col.key)}>{col.label}</SelectItem>
        ))}
      </Select>
      <button
        type="button"
        aria-label="Cambiar direccion de orden"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-medium border border-default-200 bg-content1 text-default-600 transition hover:bg-default-100"
        onClick={() => setSortDescriptor((s) => ({
          ...s,
          direction: s.direction === 'ascending' ? 'descending' : 'ascending',
        }))}
      >
        {sortDescriptor.column === '' ? (
          <ArrowUpDown className="h-4 w-4" />
        ) : sortDescriptor.direction === 'ascending' ? (
          <ArrowUp className="h-4 w-4" />
        ) : (
          <ArrowDown className="h-4 w-4" />
        )}
      </button>
    </div>
  )

  const bottomContent = totalPages > 1 ? (
    <div className="flex justify-center py-2">
      <Pagination
        isCompact
        showControls
        color="primary"
        page={page}
        total={totalPages}
        onChange={setPage}
      />
    </div>
  ) : null

  const primaryKey = columns[0]?.key
  const mobileCards = (
    <div className="flex flex-col gap-3 md:hidden">
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner color="primary" />
        </div>
      ) : paged.length === 0 ? (
        <Card shadow="sm">
          <CardBody className="py-8 text-center text-small text-default-500">
            Sin datos
          </CardBody>
        </Card>
      ) : (
        paged.map((item, i) => {
          const record = item as Record<string, unknown>
          const primaryValue = primaryKey ? String(record[String(primaryKey)] ?? '-') : ''
          return (
            <Card
              key={`mobile-${i}`}
              shadow="sm"
              className="border border-default-100"
            >
              <CardBody className="gap-2 p-4">
                {primaryKey && (
                  <div className="flex items-center justify-between border-b border-default-100 pb-2">
                    <span className="text-tiny uppercase tracking-wide text-default-500">
                      {columns[0].label}
                    </span>
                    <span className="text-small font-semibold text-foreground">
                      {columns[0].render
                        ? columns[0].render(item[columns[0].key], item)
                        : primaryValue}
                    </span>
                  </div>
                )}
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-small">
                  {columns.slice(1).map((col) => (
                    <div key={String(col.key)} className="contents">
                      <dt className="text-tiny uppercase tracking-wide text-default-500">
                        {col.label}
                      </dt>
                      <dd className="text-right text-small text-foreground break-words">
                        {col.render
                          ? col.render(item[col.key], item)
                          : String(item[col.key] ?? '-')}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardBody>
            </Card>
          )
        })
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      {topContent}
      {mobileSort}
      {mobileCards}
      <div className="hidden md:block">
        <Table
          aria-label={title ?? 'Data table'}
          isHeaderSticky
          isStriped
          sortDescriptor={sortDescriptor}
          onSortChange={(d) => setSortDescriptor(d as { column: string; direction: 'ascending' | 'descending' })}
          classNames={{
            wrapper: 'shadow-sm',
          }}
        >
          <TableHeader columns={columns.map((c) => ({ key: String(c.key), label: c.label, sortable: c.sortable !== false }))}>
            {(column) => (
              <TableColumn key={column.key} allowsSorting={column.sortable}>
                {column.label}
              </TableColumn>
            )}
          </TableHeader>
          <TableBody
            items={paged.map((item, i) => ({ row: item, _key: String(i) }))}
            isLoading={isLoading}
            loadingContent={<Spinner color="primary" />}
            emptyContent="Sin datos"
          >
            {(item) => (
              <TableRow key={item._key as string}>
                {(columnKey) => (
                  <TableCell>{renderCell(item.row as T, String(columnKey))}</TableCell>
                )}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {bottomContent}
    </div>
  )
}

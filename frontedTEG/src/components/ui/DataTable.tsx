import { useState, useMemo, useCallback } from 'react'
import {
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Pagination, Input, Spinner, Chip,
} from '@heroui/react'
import { Search } from 'lucide-react'

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
    <div className="flex items-center justify-between gap-4 px-1">
      {title && <h3 className="text-lg font-semibold text-foreground">{title}</h3>}
      <div className="flex items-center gap-3">
        {searchable && (
          <Input
            isClearable
            className="w-64"
            placeholder="Buscar..."
            size="sm"
            variant="bordered"
            startContent={<Search className="h-4 w-4 text-default-400" />}
            value={search}
            onClear={() => { setSearch(''); setPage(1) }}
            onValueChange={(v) => { setSearch(v); setPage(1) }}
          />
        )}
        <Chip size="sm" variant="flat" color="default">
          {sorted.length} registros
        </Chip>
      </div>
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

  return (
    <Table
      aria-label={title ?? 'Data table'}
      isHeaderSticky
      isStriped
      sortDescriptor={sortDescriptor}
      onSortChange={(d) => setSortDescriptor(d as { column: string; direction: 'ascending' | 'descending' })}
      topContent={topContent}
      topContentPlacement="outside"
      bottomContent={bottomContent}
      bottomContentPlacement="outside"
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
  )
}

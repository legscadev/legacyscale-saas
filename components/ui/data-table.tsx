'use client'

import {
  type ColumnDef,
  type OnChangeFn,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  /** Server-side pagination — current 1-indexed page. */
  page: number
  /** Server-reported total pages. */
  pageCount: number
  /** Server-reported total row count (for the footer label). */
  total: number
  /** Page size (constant from caller). */
  pageSize: number
  onPageChange: (page: number) => void
  /** Server-side sort state (TanStack array form). */
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
  /** Optional row selection state — caller owns the source of truth. */
  rowSelection?: RowSelectionState
  onRowSelectionChange?: OnChangeFn<RowSelectionState>
  /** Called on row click (excluding clicks inside checkbox/actions cells). */
  onRowClick?: (row: TData) => void
  /** Used by TanStack to stably identify rows for selection. */
  getRowId?: (row: TData) => string
  /** Optional column visibility state — caller owns the source of truth. */
  columnVisibility?: VisibilityState
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>
  /** Render-prop for the bulk-action bar that appears when rows are
   *  selected. Receives the selected row IDs + a `clear` helper. */
  bulkActions?: (state: {
    selectedIds: string[]
    selectedCount: number
    clear: () => void
  }) => React.ReactNode
}

export function DataTable<TData, TValue>({
  columns,
  data,
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  sorting,
  onSortingChange,
  rowSelection,
  onRowSelectionChange,
  onRowClick,
  getRowId,
  bulkActions,
  columnVisibility,
  onColumnVisibilityChange,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      ...(rowSelection ? { rowSelection } : {}),
      ...(columnVisibility ? { columnVisibility } : {}),
      pagination: { pageIndex: page - 1, pageSize },
    },
    onSortingChange,
    ...(onRowSelectionChange ? { onRowSelectionChange } : {}),
    ...(onColumnVisibilityChange ? { onColumnVisibilityChange } : {}),
    enableRowSelection: !!onRowSelectionChange,
    manualSorting: true,
    manualPagination: true,
    pageCount,
    getCoreRowModel: getCoreRowModel(),
    ...(getRowId ? { getRowId } : {}),
  })

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const selectedIds = rowSelection ? Object.keys(rowSelection).filter((k) => rowSelection[k]) : []
  const selectedCount = selectedIds.length
  const showBulkBar = !!bulkActions && selectedCount > 0
  const clearSelection = () => onRowSelectionChange?.({})

  return (
    <div className="relative space-y-3">
      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/[0.07] shadow-sm shadow-foreground/[0.02] dark:shadow-black/15">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{
                      width: header.getSize() !== 150 ? header.getSize() : undefined,
                    }}
                    className={cn(
                      header.column.columnDef.meta &&
                        // @ts-expect-error — meta is open-ended
                        header.column.columnDef.meta.className,
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  No results.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={onRowClick ? 'cursor-pointer' : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      onClick={(e) => {
                        // Don't bubble row click for cells flagged as stoppers.
                        // @ts-expect-error — meta is open-ended
                        if (cell.column.columnDef.meta?.stopRowClick) {
                          e.stopPropagation()
                        }
                      }}
                      className={cn(
                        cell.column.columnDef.meta &&
                          // @ts-expect-error — meta is open-ended
                          cell.column.columnDef.meta.className,
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Sticky bulk-action bar — animates in when selection is non-empty. */}
      {showBulkBar ? (
        <div className="pointer-events-none sticky bottom-4 z-20 flex justify-center">
          <div
            role="toolbar"
            aria-label="Bulk actions"
            className="pointer-events-auto flex items-center gap-2 rounded-full border bg-foreground/95 px-2 py-1.5 text-background shadow-2xl shadow-foreground/20 backdrop-blur animate-in fade-in slide-in-from-bottom-2 duration-200"
          >
            <span className="px-3 text-sm font-medium tabular-nums">
              {selectedCount} selected
            </span>
            <div className="h-5 w-px bg-background/20" />
            {bulkActions!({
              selectedIds,
              selectedCount,
              clear: clearSelection,
            })}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={clearSelection}
              aria-label="Clear selection"
              className="text-background/70 hover:bg-background/10 hover:text-background"
            >
              <X />
            </Button>
          </div>
        </div>
      ) : null}

      {pageCount > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>
            Showing <span className="font-medium text-foreground">{from}</span>–
            <span className="font-medium text-foreground">{to}</span> of{' '}
            <span className="font-medium text-foreground">{total}</span>
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft />
            </Button>
            <span className="px-2 tabular-nums">
              Page {page} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= pageCount}
              aria-label="Next page"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

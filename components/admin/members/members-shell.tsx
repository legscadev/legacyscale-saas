'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  OnChangeFn,
  RowSelectionState,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table'
import { Plus, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { PageHeader, EmptyState } from '@/components/shared'
import { MembersMetrics } from './members-metrics'
import { MembersToolbar } from './members-toolbar'
import { BulkActionBar } from './bulk-action-bar'
import { MemberCreateDialog } from './member-create-dialog'
import { getMemberColumns } from './columns'
import {
  fetchMembers,
  type MembersData,
  type MembersQueryState,
} from '@/app/(admin)/admin/members/actions'
import type {
  MemberSortField,
  SortDirection,
} from '@/lib/services/member-service'

export const DEFAULT_QUERY_STATE: MembersQueryState = {
  search: '',
  role: null,
  status: null,
  sort: 'createdAt',
  direction: 'desc',
  page: 1,
}

const PAGE_SIZE = 10

interface MembersShellProps {
  currentUserId: string
  initialData: MembersData
}

export function MembersShell({
  currentUserId,
  initialData,
}: MembersShellProps) {
  const [query, setQuery] = useState<MembersQueryState>(DEFAULT_QUERY_STATE)
  const [data, setData] = useState<MembersData>(initialData)
  const [isLoading, setIsLoading] = useState(false)

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const saved = localStorage.getItem('kondense:members:columnVisibility')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })
  const [createOpen, setCreateOpen] = useState(false)
  // Bumped to trigger an out-of-band refetch (e.g. after creating a
  // member via the dialog) without changing the query state.
  const [refetchKey, setRefetchKey] = useState(0)

  // Persist column visibility to localStorage.
  useEffect(() => {
    try {
      localStorage.setItem('kondense:members:columnVisibility', JSON.stringify(columnVisibility))
    } catch { /* noop */ }
  }, [columnVisibility])

  // Skip the very first effect run — the server-fetched initialData
  // already matches DEFAULT_QUERY_STATE, no need to refetch. After that,
  // every query change (including "Clear" → back to defaults) refetches.
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const controller = new AbortController()
    setIsLoading(true)
    void (async () => {
      try {
        const next = await fetchMembers(query)
        if (controller.signal.aborted) return
        setData(next)
      } catch (err) {
        if (controller.signal.aborted) return
        console.error('[members] fetch failed', err)
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    })()
    return () => controller.abort()
  }, [query, refetchKey])

  // Drop any selections that no longer exist in the current data (e.g.
  // after filtering or paging).
  useEffect(() => {
    setRowSelection((prev) => {
      const visible = new Set(data.items.map((m) => m.id))
      const next: RowSelectionState = {}
      for (const id of Object.keys(prev)) {
        if (visible.has(id)) next[id] = prev[id]!
      }
      return next
    })
  }, [data.items])

  const patch = useCallback((updates: Partial<MembersQueryState>) => {
    setQuery((prev) => {
      const resetsPage = !('page' in updates)
      return {
        ...prev,
        ...updates,
        ...(resetsPage ? { page: 1 } : {}),
      }
    })
  }, [])

  const clearFilters = useCallback(() => {
    setQuery(DEFAULT_QUERY_STATE)
  }, [])

  // TanStack sorting state ↔ our server-side sort/direction pair.
  const sorting: SortingState = useMemo(
    () => [{ id: query.sort, desc: query.direction === 'desc' }],
    [query.sort, query.direction],
  )
  const onSortingChange: OnChangeFn<SortingState> = useCallback(
    (updater) => {
      const next =
        typeof updater === 'function' ? updater(sorting) : updater
      const first = next[0]
      if (!first) return
      patch({
        sort: first.id as MemberSortField,
        direction: (first.desc ? 'desc' : 'asc') as SortDirection,
      })
    },
    [sorting, patch],
  )

  const refetch = useCallback(() => setRefetchKey((k) => k + 1), [])

  const columns = useMemo(
    () => getMemberColumns(currentUserId, refetch, data.sparklines),
    [currentUserId, refetch, data.sparklines],
  )

  const selectedIds = Object.keys(rowSelection)
  const hasActiveFilters =
    query.search.length > 0 || query.role !== null || query.status !== null
  const showEmpty = data.items.length === 0
  const onlyAdminInPlatform = data.counts.all <= 1

  return (
    <div className="space-y-6" data-pending={isLoading}>
      <PageHeader
        title="Members"
        description={`Manage ${data.counts.all.toLocaleString()} ${
          data.counts.all === 1 ? 'person' : 'people'
        } across your platform.`}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Add member
          </Button>
        }
      />

      <MembersMetrics counts={data.counts} />

      <div className="space-y-4">
        <MembersToolbar
          search={query.search}
          role={query.role}
          status={query.status}
          onSearchChange={(search) => patch({ search })}
          onRoleChange={(role) => patch({ role })}
          onStatusChange={(status) => patch({ status })}
          onClearAll={clearFilters}
          isPending={isLoading}
          columnVisibility={columnVisibility}
          columns={columns}
          onColumnVisibilityChange={setColumnVisibility}
        />

        {showEmpty ? (
          <EmptyState
            icon={Users}
            title={
              hasActiveFilters
                ? 'No members match these filters'
                : onlyAdminInPlatform
                  ? 'No members yet'
                  : 'No results'
            }
            description={
              hasActiveFilters
                ? 'Try widening your search or clearing filters.'
                : onlyAdminInPlatform
                  ? "Add your first member to get started — they'll show up here once created."
                  : 'Members will appear here when they match these filters.'
            }
          />
        ) : (
          <DataTable
            key={refetchKey}
            columns={columns}
            data={data.items}
            page={data.page}
            pageCount={data.totalPages}
            total={data.total}
            pageSize={PAGE_SIZE}
            onPageChange={(page) => patch({ page })}
            sorting={sorting}
            onSortingChange={onSortingChange}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={setColumnVisibility}
            getRowId={(row) => row.id}
          />
        )}
      </div>

      <BulkActionBar
        selectedIds={selectedIds}
        members={data.items}
        currentUserId={currentUserId}
        onClear={() => setRowSelection({})}
        onRefetch={refetch}
      />

      <MemberCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={refetch}
      />
    </div>
  )
}

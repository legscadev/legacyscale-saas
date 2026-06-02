'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import type {
  OnChangeFn,
  RowSelectionState,
  SortingState,
} from '@tanstack/react-table'
import { Plus, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { PageHeader, EmptyState } from '@/components/shared'
import { MembersMetrics } from './members-metrics'
import { MembersToolbar } from './members-toolbar'
import { BulkActionBar } from './bulk-action-bar'
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

const PAGE_SIZE = 20

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
  const [isPending, startTransition] = useTransition()

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  // Skip the very first effect run — the server-fetched initialData
  // already matches DEFAULT_QUERY_STATE, no need to refetch. After that,
  // every query change (including "Clear" → back to defaults) refetches.
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    let cancelled = false
    startTransition(() => {
      fetchMembers(query).then((next) => {
        if (!cancelled) setData(next)
      })
    })
    return () => {
      cancelled = true
    }
  }, [query])

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

  const columns = useMemo(
    () => getMemberColumns(currentUserId),
    [currentUserId],
  )

  const selectedIds = Object.keys(rowSelection)
  const hasActiveFilters =
    query.search.length > 0 || query.role !== null || query.status !== null
  const showEmpty = data.items.length === 0
  const onlyAdminInPlatform = data.counts.all <= 1

  return (
    <div className="space-y-6" data-pending={isPending}>
      <PageHeader
        title="Members"
        description={`Manage ${data.counts.all.toLocaleString()} ${
          data.counts.all === 1 ? 'person' : 'people'
        } across your platform.`}
        actions={
          <Button disabled>
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
          isPending={isPending}
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
            getRowId={(row) => row.id}
          />
        )}
      </div>

      <BulkActionBar
        selectedCount={selectedIds.length}
        onClear={() => setRowSelection({})}
      />
    </div>
  )
}

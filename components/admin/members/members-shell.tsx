'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { Plus, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { PageHeader, EmptyState } from '@/components/shared'
import { MembersMetrics } from './members-metrics'
import { MembersTabs } from './members-tabs'
import { MembersToolbar } from './members-toolbar'
import { MembersTable } from './members-table'
import { MembersPagination } from './members-pagination'
import {
  fetchMembers,
  type MembersData,
  type MembersQueryState,
} from '@/app/(admin)/admin/members/actions'

export const DEFAULT_QUERY_STATE: MembersQueryState = {
  tab: 'all',
  search: '',
  role: null,
  status: null,
  sort: 'createdAt',
  direction: 'desc',
  page: 1,
}

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

  // Refetch whenever query changes — except on first render, where the
  // server-provided initialData already matches the default state.
  useEffect(() => {
    if (query === DEFAULT_QUERY_STATE) return
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

  const patch = useCallback(
    (updates: Partial<MembersQueryState>) => {
      setQuery((prev) => {
        const resetsPage = 'page' in updates ? false : true
        return {
          ...prev,
          ...updates,
          ...(resetsPage ? { page: 1 } : {}),
        }
      })
    },
    [],
  )

  const clearFilters = useCallback(() => {
    setQuery((prev) => ({
      ...DEFAULT_QUERY_STATE,
      tab: prev.tab,
    }))
  }, [])

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
        <MembersTabs
          active={query.tab}
          counts={data.counts}
          onChange={(tab) => patch({ tab })}
        />
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
                  : 'Nothing in this tab'
            }
            description={
              hasActiveFilters
                ? 'Try widening your search or clearing filters.'
                : onlyAdminInPlatform
                  ? "Add your first member to get started — they'll show up here once created."
                  : 'Members will appear here when they match this tab.'
            }
          />
        ) : (
          <>
            <MembersTable
              members={data.items}
              currentUserId={currentUserId}
              sort={query.sort}
              direction={query.direction}
              onSortChange={(sort, direction) => patch({ sort, direction })}
            />
            <MembersPagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              limit={data.limit}
              onPageChange={(page) => patch({ page })}
            />
          </>
        )}
      </div>
    </div>
  )
}

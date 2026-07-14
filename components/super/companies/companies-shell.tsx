'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { OnChangeFn, SortingState } from '@tanstack/react-table'
import { Building2 } from 'lucide-react'

import { DataTable } from '@/components/ui/data-table'
import { EmptyState } from '@/components/shared'

import { fetchCompanies } from '@/app/(super)/super/companies/actions'
import {
  COMPANY_DIRECTORY_PAGE_SIZE,
  type CompanyDirectoryData,
  type CompanyDirectoryQuery,
  type CompanyDirectorySort,
  type CompanyKindFilter,
  type SortDirection,
} from '@/app/(super)/super/companies/types'

import { companyColumns } from './columns'
import { CompaniesProvider } from './companies-context'
import { CompaniesToolbar } from './companies-toolbar'

const DEFAULT_QUERY: CompanyDirectoryQuery = {
  search: '',
  kind: 'all',
  sort: 'name',
  direction: 'asc',
  page: 1,
}

interface CompaniesShellProps {
  initialData: CompanyDirectoryData
}

export function CompaniesShell({ initialData }: CompaniesShellProps) {
  const [query, setQuery] = useState<CompanyDirectoryQuery>(DEFAULT_QUERY)
  const [data, setData] = useState<CompanyDirectoryData>(initialData)
  const [isLoading, setIsLoading] = useState(false)
  // Bumped by refetch() so mutation callers (delete, clone) can force
  // a re-run of the fetch effect against the same query.
  const [refreshTick, setRefreshTick] = useState(0)

  // Skip the initial effect run since server-rendered initialData
  // already matches DEFAULT_QUERY.
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
        const next = await fetchCompanies(query)
        if (controller.signal.aborted) return
        setData(next)
      } catch (err) {
        if (controller.signal.aborted) return
        console.error('[super/companies] fetch failed', err)
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    })()
    return () => controller.abort()
  }, [query, refreshTick])

  const refetch = useCallback(() => {
    setRefreshTick((t) => t + 1)
  }, [])

  const patch = useCallback((updates: Partial<CompanyDirectoryQuery>) => {
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
    setQuery(DEFAULT_QUERY)
  }, [])

  // TanStack sorting state ↔ our server-side sort/direction pair.
  const sorting: SortingState = useMemo(
    () => [{ id: query.sort, desc: query.direction === 'desc' }],
    [query.sort, query.direction],
  )
  const onSortingChange: OnChangeFn<SortingState> = useCallback(
    (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater
      const first = next[0]
      if (!first) return
      patch({
        sort: first.id as CompanyDirectorySort,
        direction: (first.desc ? 'desc' : 'asc') as SortDirection,
      })
    },
    [sorting, patch],
  )

  const hasActiveFilters =
    query.search.length > 0 || query.kind !== 'all'
  const showEmpty = data.items.length === 0

  return (
    <CompaniesProvider value={{ refetch }}>
    <div className="space-y-4" data-pending={isLoading}>
      <CompaniesToolbar
        search={query.search}
        kind={query.kind}
        onSearchChange={(search) => patch({ search })}
        onKindChange={(kind) => patch({ kind })}
        onClearAll={clearFilters}
        isPending={isLoading}
      />

      {showEmpty ? (
        <EmptyState
          icon={Building2}
          title={
            hasActiveFilters
              ? 'No companies match these filters'
              : 'No companies yet'
          }
          description={
            hasActiveFilters
              ? 'Try widening your search or clearing filters.'
              : "Sub-accounts will show up here once they're created."
          }
        />
      ) : (
        <DataTable
          columns={companyColumns}
          data={data.items}
          page={data.page}
          pageCount={data.totalPages}
          total={data.total}
          pageSize={COMPANY_DIRECTORY_PAGE_SIZE}
          onPageChange={(page) => patch({ page })}
          sorting={sorting}
          onSortingChange={onSortingChange}
          getRowId={(row) => row.id}
        />
      )}
    </div>
    </CompaniesProvider>
  )
}

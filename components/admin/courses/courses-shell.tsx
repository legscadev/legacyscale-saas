'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import Link from 'next/link'
import type {
  OnChangeFn,
  SortingState,
} from '@tanstack/react-table'
import { GraduationCap, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { PageHeader, EmptyState } from '@/components/shared'
import { CoursesMetrics } from './courses-metrics'
import { CoursesToolbar } from './courses-toolbar'
import { getCourseColumns } from './columns'
import {
  fetchCourses,
  type CoursesData,
  type CoursesQueryState,
} from '@/app/(admin)/admin/courses/actions'
import type {
  CourseSortField,
  SortDirection,
} from '@/lib/services/course-service'
import type { CourseAudience } from '@prisma/client'

export const DEFAULT_QUERY_STATE: CoursesQueryState = {
  search: '',
  status: null,
  view: 'active',
  sort: 'createdAt',
  direction: 'desc',
  page: 1,
}

const PAGE_SIZE = 10

interface CoursesShellProps {
  initialData: CoursesData
  /** Audience lens — locks the list to this set. Undefined = show
   *  every course regardless of audience (legacy behaviour). */
  audiences?: CourseAudience[]
  /** Override page title (defaults to "Courses"). */
  pageTitle?: string
  /** Override page subtitle. Defaults to "Manage N courses…". */
  pageDescription?: string
  /** Copy on the primary create button (defaults to "Create course"). */
  createLabel?: string
  /** Where the create button navigates (defaults to
   *  /admin/courses/new). Trainings pass an audience query so the
   *  form defaults to INTERNAL. */
  createHref?: string
  /** Copy for the empty-state title (defaults to "No courses yet"). */
  emptyTitle?: string
  emptyDescription?: string
  /** Singular / plural noun used in stats + empty copy. */
  noun?: { singular: string; plural: string }
}

export function CoursesShell({
  initialData,
  audiences,
  pageTitle,
  pageDescription,
  createLabel,
  createHref,
  emptyTitle,
  emptyDescription,
  noun,
}: CoursesShellProps) {
  const lensDefaults: CoursesQueryState = {
    ...DEFAULT_QUERY_STATE,
    audiences: audiences ?? null,
  }
  const [query, setQuery] = useState<CoursesQueryState>(lensDefaults)
  const [data, setData] = useState<CoursesData>(initialData)
  const [isPending, startTransition] = useTransition()
  const [refetchKey, setRefetchKey] = useState(0)

  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    let cancelled = false
    startTransition(() => {
      fetchCourses(query).then((next) => {
        if (!cancelled) setData(next)
      })
    })
    return () => {
      cancelled = true
    }
  }, [query, refetchKey])

  const patch = useCallback((updates: Partial<CoursesQueryState>) => {
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
    // Preserve the audience lens on Clear-all so the page doesn't
    // silently escape into a different population.
    setQuery({ ...DEFAULT_QUERY_STATE, audiences: audiences ?? null })
  }, [audiences])

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
        sort: first.id as CourseSortField,
        direction: (first.desc ? 'desc' : 'asc') as SortDirection,
      })
    },
    [sorting, patch],
  )

  const refetch = useCallback(() => setRefetchKey((k) => k + 1), [])

  const columns = useMemo(() => getCourseColumns(refetch), [refetch])

  const hasActiveFilters =
    query.search.length > 0 ||
    query.status !== null ||
    query.view !== 'active'
  const showEmpty = data.items.length === 0
  const noCoursesAtAll = data.counts.all === 0 && data.counts.deleted === 0

  return (
    <div className="space-y-6" data-pending={isPending}>
      <PageHeader
        title={pageTitle ?? 'Courses'}
        description={
          pageDescription ??
          `Manage ${data.counts.all.toLocaleString()} ${
            data.counts.all === 1
              ? (noun?.singular ?? 'course')
              : (noun?.plural ?? 'courses')
          } across your platform.`
        }
        actions={
          <Button render={<Link href={createHref ?? '/admin/courses/new'} />}>
            <Plus className="size-4" />
            {createLabel ?? 'Create course'}
          </Button>
        }
      />

      <CoursesMetrics counts={data.counts} />

      <div className="space-y-4">
        <CoursesToolbar
          search={query.search}
          status={query.status}
          view={query.view}
          onSearchChange={(search) => patch({ search })}
          onStatusChange={(status) => patch({ status })}
          onViewChange={(view) => patch({ view })}
          onClearAll={clearFilters}
          isPending={isPending}
        />

        {showEmpty ? (
          <EmptyState
            icon={GraduationCap}
            title={
              hasActiveFilters
                ? `No ${noun?.plural ?? 'courses'} match these filters`
                : noCoursesAtAll
                  ? (emptyTitle ?? `No ${noun?.plural ?? 'courses'} yet`)
                  : 'No results'
            }
            description={
              hasActiveFilters
                ? 'Try widening your search or clearing filters.'
                : noCoursesAtAll
                  ? (emptyDescription ??
                    `Create your first ${noun?.singular ?? 'course'} to get started.`)
                  : `${(noun?.plural ?? 'Courses').charAt(0).toUpperCase() + (noun?.plural ?? 'Courses').slice(1)} will appear here when they match these filters.`
            }
          >
            {noCoursesAtAll && !hasActiveFilters ? (
              <Button render={<Link href={createHref ?? '/admin/courses/new'} />}>
                <Plus className="size-4" />
                {createLabel ?? 'Create course'}
              </Button>
            ) : null}
          </EmptyState>
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
            getRowId={(row) => row.id}
          />
        )}
      </div>
    </div>
  )
}

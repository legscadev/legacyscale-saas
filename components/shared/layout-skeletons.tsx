import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * Skeleton that mirrors the PageHeader: accent bar + title + description.
 */
function HeaderSkeleton({ withAction }: { withAction?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-1 w-10 rounded-full" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      {withAction ? <Skeleton className="h-9 w-32 rounded-lg" /> : null}
    </div>
  )
}

/**
 * Mirrors a single StatCard — top accent bar, icon badge slot, big number.
 */
function StatCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <Skeleton className="absolute inset-x-0 top-0 h-1 rounded-none" />
      <div className="flex items-start justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-10 rounded-xl" />
      </div>
      <Skeleton className="mt-4 h-10 w-16" />
      <Skeleton className="mt-2 h-3 w-32" />
    </div>
  )
}

/**
 * Dashboard layout: page header, 4-up stat grid, 2-column section row.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10 lg:col-span-2">
          <Skeleton className="h-5 w-40" />
          <div className="space-y-2 pt-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
          <div className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            <Skeleton className="h-5 w-40" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Layout for a list page with PageHeader, optional metrics row,
 * toolbar, and a data table.
 */
export function TableSkeleton({
  withMetrics = true,
  withToolbar = true,
  rows = 8,
  columns = 5,
}: {
  withMetrics?: boolean
  withToolbar?: boolean
  rows?: number
  columns?: number
}) {
  return (
    <div className="space-y-6">
      <HeaderSkeleton withAction />

      {withMetrics ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : null}

      {withToolbar ? (
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-64 flex-1 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="border-b bg-muted/40 px-2 py-3">
          <div
            className="grid items-center gap-4 px-2"
            style={{
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: columns }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-20" />
            ))}
          </div>
        </div>
        <ul className="divide-y">
          {Array.from({ length: rows }).map((_, r) => (
            <li
              key={r}
              className="grid items-center gap-4 px-4 py-3.5"
              style={{
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: columns }).map((_, c) => (
                <Skeleton
                  key={c}
                  className={cn('h-4', c === 0 ? 'w-3/4' : 'w-1/2')}
                />
              ))}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/**
 * Mimics a single MemberCourseCard.
 */
function CourseCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
        <div className="flex items-center gap-3 pt-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-14" />
        </div>
        <Skeleton className="mt-3 h-9 w-full rounded-lg" />
      </div>
    </div>
  )
}

/**
 * Layout for the member /courses page: hero + horizontal rows of cards.
 */
export function CourseGridSkeleton() {
  return (
    <div className="space-y-8">
      <HeaderSkeleton />

      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Hero band */}
      <Skeleton className="h-44 rounded-2xl sm:h-56 md:h-64 lg:h-72" />

      {/* Two card rows */}
      {Array.from({ length: 2 }).map((_, row) => (
        <div key={row} className="space-y-3">
          <Skeleton className="h-5 w-44" />
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 4 }).map((_, c) => (
              <div key={c} className="w-[280px] shrink-0">
                <CourseCardSkeleton />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

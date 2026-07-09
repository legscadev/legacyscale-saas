import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Mirrors the current /admin/stats layout: header actions row,
 * search + Only-mine filter, date range + preset chips, section
 * header, and a grid of metric cards (title / value / chart).
 */
export default function AdminStatsLoading() {
  return (
    <div className="space-y-6">
      {/* Page header — title + description + action buttons */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-1 w-10 rounded-full" />
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-64 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      {/* Filter bar — search + Only mine toggle */}
      <div className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Skeleton className="h-9 flex-1 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>

        {/* Date range row */}
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-28 rounded-md" />
          <Skeleton className="h-3 w-3" />
          <Skeleton className="h-8 w-28 rounded-md" />
          <div className="flex items-center gap-1">
            <Skeleton className="h-6 w-11 rounded-md" />
            <Skeleton className="h-6 w-9 rounded-md" />
            <Skeleton className="h-6 w-10 rounded-md" />
            <Skeleton className="h-6 w-10 rounded-md" />
            <Skeleton className="h-6 w-10 rounded-md" />
          </div>
        </div>
      </div>

      {/* Section header — "All metrics · N of M shown" + New metric */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      {/* Metric card grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <MetricCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

function MetricCardSkeleton() {
  return (
    <Card className="gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <div className="flex items-center gap-1.5">
            <Skeleton className="size-3 rounded-sm" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="size-8 rounded-md" />
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-3 w-14" />
      </div>

      {/* Chart body */}
      <Skeleton className="h-40 w-full rounded-md" />
    </Card>
  )
}

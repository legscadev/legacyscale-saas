import { Card } from '@/components/ui/card'
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
 * Mirrors the canonical StatStrip — horizontal multi-cell bar with
 * hairline dividers, eyebrow label + big number + sub-line per cell,
 * one rounded outer card. Match the cell count to the live page.
 */
function StatStripSkeleton({
  cells = 4,
  className,
}: { cells?: number; className?: string }) {
  // Tailwind needs the literal class names in source to JIT them;
  // mapping cells → sm:grid-cols-N this way keeps the call sites
  // simple while still letting the JIT pick up the variants.
  const smCols =
    cells === 3
      ? 'sm:grid-cols-3'
      : cells === 5
        ? 'sm:grid-cols-5'
        : cells === 7
          ? 'sm:grid-cols-7'
          : 'sm:grid-cols-4'
  return (
    <Card
      className={cn(
        'grid grid-cols-2 gap-0 divide-x divide-y divide-border p-0 sm:divide-y-0',
        smCols,
        className,
      )}
    >
      {Array.from({ length: cells }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1.5 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Skeleton className="size-3 rounded-sm" />
            <Skeleton className="h-2.5 w-20" />
          </div>
          <Skeleton className="h-7 w-12" />
          <Skeleton className="h-2.5 w-24" />
        </div>
      ))}
    </Card>
  )
}

/**
 * Member dashboard layout: header, 3-cell stat strip, resume hero,
 * Continue Learning card grid, recent announcements list.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton />

      <StatStripSkeleton cells={3} />

      {/* Resume hero — eyebrow + title + progress bar + CTA */}
      <div className="space-y-4 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
        <Skeleton className="h-3 w-44" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-1.5 w-56 rounded-full" />
          </div>
          <Skeleton className="h-10 w-36 rounded-lg sm:shrink-0" />
        </div>
      </div>

      {/* Continue Learning grid */}
      <div className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <Skeleton className="h-5 w-40" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <CourseCardSkeleton key={i} />
          ))}
        </div>
      </div>

      {/* Recent announcements list */}
      <div className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3 w-16" />
        </div>
        <ul className="divide-y">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="space-y-1.5 py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="ml-auto h-3 w-12" />
              </div>
              <Skeleton className="h-3 w-2/3" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/**
 * Admin dashboard layout: header + 4-cell stat strip + a 2-col chart
 * row + a 3-col band where the left col-span-2 stacks two list
 * sections (Needs attention, Recent completions) and the right col
 * holds Quick actions.
 */
export function AdminDashboardSkeleton() {
  return (
    <div className="space-y-4">
      <HeaderSkeleton />

      <StatStripSkeleton cells={4} />

      {/* 2-col chart row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10"
          >
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3 w-56" />
            <Skeleton className="mt-2 h-48 w-full rounded-lg" />
          </div>
        ))}
      </div>

      {/* 3-col band: list-list (col-span-2) + actions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Needs attention */}
          <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
            <div className="space-y-2 px-5 py-4">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3 w-64" />
            </div>
            <ul className="divide-y">
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="size-9 rounded-lg" />
                  <Skeleton className="h-3.5 flex-1" />
                  <Skeleton className="size-4 rounded-sm" />
                </li>
              ))}
            </ul>
          </div>
          {/* Recent completions */}
          <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
            <div className="flex items-start justify-between gap-3 px-5 py-4">
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-72" />
              </div>
              <Skeleton className="h-7 w-24 rounded-md" />
            </div>
            <ul className="divide-y">
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <Skeleton className="size-8 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="size-4 rounded-sm" />
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Quick actions column */}
        <div className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}
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

      {withMetrics ? <StatStripSkeleton cells={4} /> : null}

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
 * Course detail layout: back link, hero (cover + title block + CTA),
 * meta row, curriculum on the left, up-next + details aside on the right.
 */
export function CourseDetailSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-8 w-32 rounded-md" />

      {/* Hero */}
      <div className="grid gap-6 sm:grid-cols-[minmax(220px,300px)_1fr]">
        <Skeleton className="aspect-video w-full rounded-xl" />
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <div className="mt-auto flex flex-wrap gap-x-5 gap-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-20" />
            ))}
          </div>
          <Skeleton className="h-11 w-full rounded-lg sm:w-40" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        {/* Curriculum outline */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-40" />
          </div>
          {Array.from({ length: 3 }).map((_, ch) => (
            <div
              key={ch}
              className="space-y-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-14" />
              </div>
              {Array.from({ length: 4 }).map((_, l) => (
                <div key={l} className="flex items-center gap-3 py-1.5">
                  <Skeleton className="size-4 rounded-full" />
                  <Skeleton className="h-3.5 flex-1" />
                  <Skeleton className="h-3 w-10" />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Aside: up-next + details card */}
        <aside className="space-y-4 lg:self-start">
          <div className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="mt-2 h-9 w-full rounded-lg" />
          </div>
          <div className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            <Skeleton className="h-3 w-24" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3.5 w-12" />
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}

/**
 * Lesson player layout: title row + 2-col (main body / chapter rail),
 * with main body holding a video stub, eyebrow + title, meta strip, and
 * a "mark complete" CTA. Bottom strip = prev/next + notes affordance.
 */
export function LessonPlayerSkeleton() {
  return (
    <div className="space-y-4">
      {/* Top row: back to course + completion meta */}
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-48 rounded-md" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-20 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* Main body */}
        <div className="min-w-0 space-y-5">
          {/* Video / content area */}
          <Skeleton className="aspect-video w-full rounded-xl" />

          {/* Header */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-3" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-3/4" />
            <div className="flex flex-wrap items-center gap-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>

          {/* Mark complete CTA */}
          <Skeleton className="h-11 w-44 rounded-lg" />

          {/* Prev / next strip */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <Skeleton className="h-10 w-28 rounded-lg" />
            <Skeleton className="h-10 w-28 rounded-lg" />
          </div>
        </div>

        {/* Aside: course content (chapter rail) */}
        <aside className="space-y-3 lg:self-start">
          <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
            <div className="space-y-3 border-b p-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
            <div className="space-y-3 p-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-2 py-1.5">
                  <Skeleton className="size-4 rounded-full" />
                  <Skeleton className="h-3.5 flex-1" />
                  <Skeleton className="h-3 w-10" />
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

/**
 * Member /announcements layout: header + category chip row + a stack
 * of announcement cards (eyebrow row, title, body lines, reaction
 * footer).
 */
export function AnnouncementListSkeleton({
  rows = 5,
}: { rows?: number } = {}) {
  return (
    <div className="space-y-6">
      <HeaderSkeleton />

      {/* Category chips */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>

      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10"
          >
            <div className="flex items-center gap-2">
              <Skeleton className="size-7 rounded-full" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="ml-auto h-3 w-16" />
            </div>
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-5/6" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-6 w-12 rounded-full" />
              <Skeleton className="h-6 w-12 rounded-full" />
              <Skeleton className="h-6 w-12 rounded-full" />
            </div>
          </div>
        ))}
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

      <StatStripSkeleton cells={3} />

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

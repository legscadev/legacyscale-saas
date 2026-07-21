import Image from 'next/image'
import Link from 'next/link'
import {
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  TrendingUp,
  Users as UsersIcon,
} from 'lucide-react'

import { Progress } from '@/components/ui/progress'
import {
  EmptyState,
  SectionCard,
  StatStrip,
  StatusBadge,
  type StatStripCell,
} from '@/components/shared'
import { cn } from '@/lib/utils'
import { progressTone } from '@/lib/format'
import { requireAdmin } from '@/lib/auth/get-user'
import { adminProgressService } from '@/lib/services/admin-progress-service'
import type { CourseStatus } from '@prisma/client'

const STATUS_OPTIONS: { value: 'ALL' | CourseStatus; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ARCHIVED', label: 'Archived' },
]

interface PageProps {
  searchParams: Promise<{ status?: string }>
}

function parseStatus(raw: string | undefined): 'ALL' | CourseStatus {
  return raw === 'PUBLISHED' || raw === 'DRAFT' || raw === 'ARCHIVED'
    ? raw
    : 'ALL'
}

export default async function AdminProgressCoursesPage({
  searchParams,
}: PageProps) {
  await requireAdmin()
  const params = await searchParams
  const status = parseStatus(params.status)

  const result = await adminProgressService.listCoursesWithProgress({
    status,
  })

  function statusHref(value: 'ALL' | CourseStatus): string {
    if (value === 'ALL') return '/admin/progress/courses'
    const q = new URLSearchParams({ status: value })
    return `/admin/progress/courses?${q}`
  }

  const cells: StatStripCell[] = [
    {
      label: 'Courses',
      value: result.totals.totalCourses,
      icon: GraduationCap,
      description: status === 'ALL' ? 'All statuses' : `${status} only`,
    },
    {
      label: 'Enrollments',
      value: result.totals.totalEnrollments,
      icon: UsersIcon,
      description: 'Sum across filter',
    },
    {
      label: 'Completed',
      value: result.totals.totalCompleted,
      icon: CheckCircle2,
      description: 'Sum across filter',
    },
    {
      label: 'Avg completion',
      value: `${result.totals.avgCompletionRate}%`,
      icon: TrendingUp,
      description: 'Mean per course',
    },
  ]

  return (
    <div className="space-y-4">
      <StatStrip cells={cells} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md border bg-muted/30 p-0.5">
          {STATUS_OPTIONS.map((opt) => {
            const active = opt.value === status
            return (
              <Link
                key={opt.value}
                href={statusHref(opt.value)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {opt.label}
              </Link>
            )
          })}
        </div>
      </div>

      <SectionCard
        title={`${result.totals.totalCourses} ${
          result.totals.totalCourses === 1 ? 'course' : 'courses'
        }`}
        description="Click a course to see its cohort, completion funnel, and CSV export."
        flush
      >
        {result.rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={GraduationCap}
              title="No courses match"
              description={
                status === 'ALL'
                  ? 'Create a course on the Courses page to start tracking cohort progress.'
                  : 'Try a different status filter, or create a course in this state.'
              }
            />
          </div>
        ) : (
          <>
            <div className="sticky top-0 z-10 flex items-center gap-4 border-b bg-muted/40 px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
              <div className="size-9 shrink-0" />
              <div className="min-w-0 flex-1">Course</div>
              <div className="hidden w-40 shrink-0 md:block">Avg progress</div>
              <div className="hidden w-24 shrink-0 text-right md:block">
                Completion
              </div>
              <div className="size-4 shrink-0" />
            </div>
            <ul className="divide-y">
              {result.rows.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/admin/progress/courses/${c.id}`}
                    className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="relative size-9 shrink-0 overflow-hidden rounded-md bg-gradient-to-br from-brand-500 to-brand-700 ring-1 ring-foreground/5">
                      {c.thumbnailUrl ? (
                        <Image
                          src={c.thumbnailUrl}
                          alt={c.title}
                          fill
                          sizes="36px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 grid place-items-center text-xs font-bold text-white/85">
                          {c.title.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {c.title}
                        </p>
                        <StatusBadge status={c.status} />
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.enrolledCount} enrolled · {c.activeCount} active ·{' '}
                        {c.completedCount} completed
                      </p>
                    </div>

                    <div className="hidden w-40 shrink-0 md:block">
                      <div className="flex items-center gap-2">
                        <Progress
                          value={c.avgProgressPercent}
                          className="h-1.5 flex-1"
                        />
                        <span
                          className={cn(
                            'w-9 text-right text-xs tabular-nums',
                            progressTone(c.avgProgressPercent),
                          )}
                        >
                          {c.avgProgressPercent}%
                        </span>
                      </div>
                    </div>

                    <div
                      className={cn(
                        'hidden w-24 shrink-0 text-right text-sm font-semibold tabular-nums md:block',
                        c.completionRate >= 50
                          ? 'text-success'
                          : 'text-foreground',
                      )}
                    >
                      {c.completionRate}%
                    </div>

                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </SectionCard>
    </div>
  )
}

import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  GraduationCap,
  PlayCircle,
  TrendingUp,
  Users as UsersIcon,
  Zap,
} from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  EmptyState,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/shared'
import { cn } from '@/lib/utils'
import { adminProgressService } from '@/lib/services/admin-progress-service'
import { CohortFilters } from '@/components/admin/progress/cohort-filters'

const PAGE_SIZE = 20

function fmtDate(date: Date | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function relativeTime(date: Date | null): string {
  if (!date) return 'Never'
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.round(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  if (diffDay < 30) return `${diffDay}d ago`
  const diffMonth = Math.round(diffDay / 30)
  if (diffMonth < 12) return `${diffMonth}mo ago`
  return `${Math.round(diffMonth / 12)}y ago`
}

function getInitials(name: string | null, email: string): string {
  const source = name?.trim() || email
  const parts = source.split(/\s+/)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    search?: string
    role?: string
    status?: string
    page?: string
  }>
}

export default async function AdminProgressCohortPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params
  const sp = await searchParams

  const search = sp.search ?? ''
  const role: 'ALL' | 'MEMBER' | 'TEAM' =
    sp.role === 'MEMBER' || sp.role === 'TEAM' ? sp.role : 'ALL'
  const status: 'ALL' | 'ACTIVE' | 'COMPLETED' | 'EXPIRED' =
    sp.status === 'ACTIVE' ||
    sp.status === 'COMPLETED' ||
    sp.status === 'EXPIRED'
      ? sp.status
      : 'ALL'
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1)

  const [summary, cohort] = await Promise.all([
    adminProgressService.getCourseProgressSummary(id),
    adminProgressService.getCourseCohort(
      id,
      { search, role, status },
      page,
      PAGE_SIZE,
    ),
  ])

  if (!summary) notFound()
  const { course, kpis } = summary

  // Carry filters into the export href so the CSV matches what the
  // operator currently sees.
  const exportParams = new URLSearchParams()
  if (search) exportParams.set('search', search)
  if (role !== 'ALL') exportParams.set('role', role)
  if (status !== 'ALL') exportParams.set('status', status)
  const exportHref = `/admin/progress/courses/${id}/export${
    exportParams.size > 0 ? `?${exportParams.toString()}` : ''
  }`

  // Pagination links — preserve all current filters except `page`.
  function paginationHref(targetPage: number): string {
    const next = new URLSearchParams()
    if (search) next.set('search', search)
    if (role !== 'ALL') next.set('role', role)
    if (status !== 'ALL') next.set('status', status)
    if (targetPage > 1) next.set('page', String(targetPage))
    const qs = next.toString()
    return `/admin/progress/courses/${id}${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2"
        render={<Link href="/admin/progress/courses" />}
      >
        <ArrowLeft />
        Back to courses
      </Button>

      <SectionCard>
        <div className="flex items-start gap-4">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 ring-1 ring-foreground/5">
            {course.thumbnailUrl ? (
              <Image
                src={course.thumbnailUrl}
                alt={course.title}
                fill
                sizes="64px"
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-lg font-bold text-white/85">
                {course.title.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold tracking-tight">
                {course.title}
              </h2>
              <StatusBadge status={course.status} />
            </div>
            <Link
              href={`/admin/courses/${course.id}`}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Open course builder →
            </Link>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard
          size="sm"
          title="Enrolled"
          value={kpis.enrolled}
          icon={UsersIcon}
          tone="info"
        />
        <StatCard
          size="sm"
          title="In progress"
          value={kpis.active}
          icon={PlayCircle}
          tone="neutral"
        />
        <StatCard
          size="sm"
          title="Completed"
          value={kpis.completed}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          size="sm"
          title="Avg progress"
          value={`${kpis.avgProgressPercent}%`}
          icon={TrendingUp}
          tone="brand"
        />
        <StatCard
          size="sm"
          title="Completion rate"
          value={`${kpis.completionRate}%`}
          icon={GraduationCap}
          tone="success"
        />
        <StatCard
          size="sm"
          title="Weekly active"
          value={kpis.weeklyActive}
          icon={Zap}
          tone="violet"
          description="Last 7 days"
        />
      </div>

      <SectionCard
        title="Cohort"
        description="Everyone enrolled in this course — search, filter, and export as CSV."
        action={
          <Button
            variant="outline"
            size="sm"
            render={
              <a href={exportHref} download={`${course.title}-cohort.csv`} />
            }
          >
            <Download />
            Export CSV
          </Button>
        }
        flush
      >
        <div className="border-b px-5 py-3">
          <CohortFilters
            initialSearch={search}
            initialRole={role}
            initialStatus={status}
          />
        </div>

        {cohort.rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={UsersIcon}
              title="No enrolled members match"
              description={
                search || role !== 'ALL' || status !== 'ALL'
                  ? 'Try clearing or adjusting the filters above.'
                  : 'Once members enroll in this course, they will show up here.'
              }
            />
          </div>
        ) : (
          <>
            <ul className="divide-y">
              {cohort.rows.map((r) => {
                const completed = r.completedAt !== null
                return (
                  <li key={r.enrollmentId}>
                    <Link
                      href={`/admin/progress/members/${r.user.id}`}
                      className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/40"
                    >
                      <Avatar>
                        {r.user.avatarUrl ? (
                          <AvatarImage src={r.user.avatarUrl} />
                        ) : null}
                        <AvatarFallback>
                          {getInitials(r.user.name, r.user.email)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">
                            {r.user.name ?? r.user.email.split('@')[0]}
                          </p>
                          <StatusBadge status={r.user.role} />
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {r.user.email}
                        </p>
                      </div>

                      <div className="hidden w-40 shrink-0 md:block">
                        <div className="flex items-center gap-2">
                          <Progress
                            value={r.progressPercent}
                            className="h-1.5 flex-1"
                          />
                          <span
                            className={cn(
                              'w-9 text-right text-xs tabular-nums',
                              completed
                                ? 'text-success'
                                : 'text-muted-foreground',
                            )}
                          >
                            {r.progressPercent}%
                          </span>
                        </div>
                      </div>

                      <div className="hidden w-28 shrink-0 text-right sm:block">
                        <StatusBadge
                          status={completed ? 'COMPLETED' : r.status}
                          label={completed ? 'Completed' : undefined}
                        />
                      </div>

                      <div className="hidden w-28 shrink-0 text-right text-xs text-muted-foreground lg:block">
                        {relativeTime(r.lastAccessedAt)}
                      </div>

                      <div className="hidden w-24 shrink-0 text-right text-xs text-muted-foreground lg:block">
                        {fmtDate(r.enrolledAt)}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>

            <div className="flex items-center justify-between gap-3 border-t bg-muted/20 px-5 py-3 text-xs text-muted-foreground">
              <span>
                Showing {(cohort.page - 1) * PAGE_SIZE + 1}–
                {Math.min(cohort.page * PAGE_SIZE, cohort.total)} of{' '}
                {cohort.total}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={cohort.page <= 1}
                  render={
                    cohort.page > 1 ? (
                      <Link href={paginationHref(cohort.page - 1)} />
                    ) : undefined
                  }
                >
                  Previous
                </Button>
                <span className="px-1 tabular-nums">
                  Page {cohort.page} of {cohort.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={cohort.page >= cohort.totalPages}
                  render={
                    cohort.page < cohort.totalPages ? (
                      <Link href={paginationHref(cohort.page + 1)} />
                    ) : undefined
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  )
}

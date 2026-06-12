import Link from 'next/link'
import {
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  TrendingUp,
  Users,
} from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  EmptyState,
  SectionCard,
  StatStrip,
  StatusBadge,
  type StatStripCell,
} from '@/components/shared'
import { cn } from '@/lib/utils'
import { getInitials, progressTone, relativeTime } from '@/lib/format'
import { adminProgressService } from '@/lib/services/admin-progress-service'
import type { MembersSort } from '@/lib/services/admin-progress-service'
import { MembersListFilters } from '@/components/admin/progress/members-list-filters'

const PAGE_SIZE = 20

interface PageProps {
  searchParams: Promise<{
    search?: string
    role?: string
    sort?: string
    page?: string
  }>
}

function parseSort(raw: string | undefined): MembersSort {
  return raw === 'progress' ||
    raw === 'enrollments' ||
    raw === 'name' ||
    raw === 'recent'
    ? raw
    : 'recent'
}

const SORT_DESCRIPTIONS: Record<MembersSort, string> = {
  recent: 'sorted by most recent activity',
  progress: 'sorted by highest avg progress',
  enrollments: 'sorted by most enrollments',
  name: 'sorted by name',
}

export default async function AdminProgressMembersPage({
  searchParams,
}: PageProps) {
  const params = await searchParams
  const search = params.search ?? ''
  const roleParam = params.role
  const role: 'ALL' | 'MEMBER' | 'TEAM' =
    roleParam === 'MEMBER' || roleParam === 'TEAM' ? roleParam : 'ALL'
  const sort = parseSort(params.sort)
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1)

  const result = await adminProgressService.listMembersWithProgress(
    { search, role },
    page,
    PAGE_SIZE,
    sort,
  )

  function buildQs(overrides: Record<string, string | null> = {}): string {
    const next = new URLSearchParams()
    if (search) next.set('search', search)
    if (role !== 'ALL') next.set('role', role)
    if (sort !== 'recent') next.set('sort', sort)
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null) next.delete(k)
      else next.set(k, v)
    }
    return next.toString()
  }

  const exportQs = buildQs()
  const exportHref = `/admin/progress/members/export${
    exportQs ? `?${exportQs}` : ''
  }`

  function paginationHref(targetPage: number): string {
    const qs = buildQs(targetPage > 1 ? { page: String(targetPage) } : {})
    return `/admin/progress/members${qs ? `?${qs}` : ''}`
  }

  const cells: StatStripCell[] = [
    {
      label: 'Members',
      value: result.total,
      icon: Users,
      description: search || role !== 'ALL' ? 'Filtered' : 'With enrollments',
    },
    {
      label: 'Enrollments',
      value: result.totals.totalEnrollments,
      icon: GraduationCap,
      description: 'Sum across filter',
    },
    {
      label: 'Avg progress',
      value: `${result.totals.avgProgressPercent}%`,
      icon: TrendingUp,
      description: 'Mean per member',
    },
    {
      label: 'Completed courses',
      value: result.totals.completedCourses,
      icon: CheckCircle2,
      description: 'Across filtered members',
    },
  ]

  return (
    <div className="space-y-4">
      <StatStrip cells={cells} />

      <MembersListFilters
        initialSearch={search}
        initialRole={role}
        initialSort={sort}
        exportHref={exportHref}
      />

      <SectionCard
        title={`${result.total} ${result.total === 1 ? 'member' : 'members'}`}
        description={
          search
            ? `Matching "${search}"`
            : `Members with at least one enrollment, ${SORT_DESCRIPTIONS[sort]}.`
        }
        flush
      >
        {result.rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Users}
              title="No members yet"
              description={
                search
                  ? 'Try adjusting your search or role filter.'
                  : 'Once users enroll in a course, they will appear here.'
              }
            />
          </div>
        ) : (
          <>
            <div className="sticky top-0 z-10 flex items-center gap-4 border-b bg-muted/40 px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
              <div className="size-9 shrink-0" />
              <div className="min-w-0 flex-1">Member</div>
              <div className="hidden w-40 shrink-0 md:block">Avg progress</div>
              <div className="hidden w-24 shrink-0 text-right md:block">
                Completed
              </div>
              <div className="hidden w-28 shrink-0 text-right sm:block">
                Last activity
              </div>
              <div className="size-4 shrink-0" />
            </div>
            <ul className="divide-y">
              {result.rows.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/admin/progress/members/${m.id}`}
                    className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/40"
                  >
                    <Avatar className="size-9">
                      {m.avatarUrl ? <AvatarImage src={m.avatarUrl} /> : null}
                      <AvatarFallback className="text-xs">
                        {getInitials(m.name, m.email)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {m.name ?? m.email.split('@')[0]}
                        </p>
                        <StatusBadge status={m.role} />
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.email}
                      </p>
                    </div>

                    <div className="hidden w-40 shrink-0 md:block">
                      <div className="flex items-center gap-2">
                        <Progress
                          value={m.avgProgressPercent}
                          className="h-1.5 flex-1"
                        />
                        <span
                          className={cn(
                            'w-9 text-right text-xs tabular-nums',
                            progressTone(m.avgProgressPercent),
                          )}
                        >
                          {m.avgProgressPercent}%
                        </span>
                      </div>
                    </div>

                    <div className="hidden w-24 shrink-0 text-right text-sm font-medium tabular-nums md:block">
                      {m.completedCourses}
                    </div>

                    <div className="hidden w-28 shrink-0 text-right text-xs text-muted-foreground sm:block">
                      {relativeTime(m.lastActivity)}
                    </div>

                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between gap-3 border-t bg-muted/20 px-5 py-3 text-xs text-muted-foreground">
              <span>
                Showing {(result.page - 1) * PAGE_SIZE + 1}–
                {Math.min(result.page * PAGE_SIZE, result.total)} of{' '}
                {result.total}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={result.page <= 1}
                  render={
                    result.page > 1 ? (
                      <Link href={paginationHref(result.page - 1)} />
                    ) : undefined
                  }
                >
                  Previous
                </Button>
                <span className="px-1 tabular-nums">
                  Page {result.page} of {result.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={result.page >= result.totalPages}
                  render={
                    result.page < result.totalPages ? (
                      <Link href={paginationHref(result.page + 1)} />
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

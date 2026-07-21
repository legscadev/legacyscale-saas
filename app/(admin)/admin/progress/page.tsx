import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  GraduationCap,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  EmptyState,
  SectionCard,
  StatStrip,
  StatusBadge,
  type StatStripCell,
} from '@/components/shared'
import { cn } from '@/lib/utils'
import { requireAdmin } from '@/lib/auth/get-user'
import { getInitials, relativeTime } from '@/lib/format'
import type { Role } from '@prisma/client'

import {
  adminProgressService,
  rangeLabel,
  type RangeFilter,
} from '@/lib/services/admin-progress-service'
import { OverviewRangePicker } from '@/components/admin/progress/overview-range-picker'

interface PageProps {
  searchParams: Promise<{ range?: string }>
}

function parseRange(raw: string | undefined): RangeFilter {
  return raw === '7d' || raw === '90d' || raw === 'all' ? raw : '30d'
}

type HighlightType = 'Stuck' | 'Engaged' | 'Completed'

interface HighlightRow {
  key: string
  type: HighlightType
  user: {
    id: string
    name: string | null
    email: string
    avatarUrl: string | null
    role: Role
  }
  courseTitle: string | null
  signal: string
  signalTone: 'positive' | 'warning' | 'neutral'
  when: Date | null
}

const TYPE_PILL: Record<HighlightType, string> = {
  Stuck: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  Engaged: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  Completed: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
}

export default async function AdminProgressOverviewPage({
  searchParams,
}: PageProps) {
  await requireAdmin()
  const params = await searchParams
  const range = parseRange(params.range)
  const window = rangeLabel(range)

  const [kpis, engaged, recent, stuck] = await Promise.all([
    adminProgressService.getOverviewKpis(range),
    adminProgressService.getMostEngagedMembers(5, range),
    adminProgressService.getRecentCompletions(5, range),
    adminProgressService.getStuckLearners(5),
  ])

  // Merge the three highlight sources into one sortable, scannable
  // table — the operator's weekly check-in fits in a single glance.
  const highlights: HighlightRow[] = [
    ...stuck.map((s) => ({
      key: `stuck-${s.enrollmentId}`,
      type: 'Stuck' as const,
      user: s.user,
      courseTitle: s.course.title,
      signal: `${s.progressPercent}% · ${s.daysSinceLastAccess}d cold`,
      signalTone: 'warning' as const,
      when: s.lastAccessedAt ?? s.enrolledAt,
    })),
    ...recent.map((r) => ({
      key: `done-${r.enrollmentId}`,
      type: 'Completed' as const,
      user: r.user,
      courseTitle: r.course.title,
      signal: '100%',
      signalTone: 'positive' as const,
      when: r.completedAt,
    })),
    ...engaged.map((e) => ({
      key: `engaged-${e.id}`,
      type: 'Engaged' as const,
      user: {
        id: e.id,
        name: e.name,
        email: e.email,
        avatarUrl: e.avatarUrl,
        role: e.role,
      },
      courseTitle: null,
      signal: `${e.completedLessons} lessons`,
      signalTone: 'positive' as const,
      when: e.lastActivity,
    })),
  ].sort((a, b) => (b.when?.getTime() ?? 0) - (a.when?.getTime() ?? 0))

  const cells: StatStripCell[] = [
    {
      label: 'Active members',
      value: kpis.activeMembers,
      icon: Users,
      description: 'Platform total',
    },
    {
      label: 'Active learners',
      value: kpis.activeLearners,
      icon: Zap,
      description: window,
    },
    {
      label: 'Avg progress',
      value: `${kpis.avgProgressPercent}%`,
      icon: TrendingUp,
      description: window,
    },
    {
      label: 'Completion rate',
      value: `${kpis.completionRate}%`,
      icon: CheckCircle2,
      description: window,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Reporting for{' '}
          <span className="font-medium text-foreground">{window}</span>
        </p>
        <OverviewRangePicker initialRange={range} />
      </div>

      <StatStrip cells={cells} />

      <SectionCard
        title="Highlights"
        description="Stuck members, recent completions, and most engaged learners — merged so the most important signals surface together."
        flush
      >
        {highlights.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Sparkles}
              title="Nothing to flag right now"
              description="Member activity, completions, and stalled progress will surface here."
            />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4 border-b bg-muted/40 px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <div className="w-20 shrink-0">Signal</div>
              <div className="flex-1">Member</div>
              <div className="hidden flex-1 sm:block">Course</div>
              <div className="hidden w-40 shrink-0 text-right md:block">
                Detail
              </div>
              <div className="w-20 shrink-0 text-right">When</div>
            </div>
            <ul className="divide-y">
              {highlights.map((h) => (
                <li key={h.key}>
                  <Link
                    href={`/admin/progress/members/${h.user.id}`}
                    className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="w-20 shrink-0">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                          TYPE_PILL[h.type],
                        )}
                      >
                        {h.type === 'Stuck' ? (
                          <AlertTriangle className="size-3" />
                        ) : h.type === 'Completed' ? (
                          <CheckCircle2 className="size-3" />
                        ) : (
                          <Sparkles className="size-3" />
                        )}
                        {h.type}
                      </span>
                    </div>

                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <Avatar className="size-7">
                        {h.user.avatarUrl ? (
                          <AvatarImage src={h.user.avatarUrl} />
                        ) : null}
                        <AvatarFallback className="text-[10px]">
                          {getInitials(h.user.name, h.user.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-medium">
                            {h.user.name ?? h.user.email.split('@')[0]}
                          </p>
                          <StatusBadge status={h.user.role} />
                        </div>
                      </div>
                    </div>

                    <div className="hidden min-w-0 flex-1 truncate text-xs text-muted-foreground sm:block">
                      {h.courseTitle ?? '—'}
                    </div>

                    <div
                      className={cn(
                        'hidden w-40 shrink-0 text-right text-xs tabular-nums md:block',
                        h.signalTone === 'positive' && 'text-success',
                        h.signalTone === 'warning' &&
                          'text-amber-600 dark:text-amber-400',
                      )}
                    >
                      {h.signal}
                    </div>

                    <div className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                      {relativeTime(h.when)}
                    </div>
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

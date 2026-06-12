import Link from 'next/link'
import {
  CheckCircle2,
  GraduationCap,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import {
  EmptyState,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/shared'
import { cn } from '@/lib/utils'
import { adminProgressService } from '@/lib/services/admin-progress-service'

function relativeTime(date: Date | null): string {
  if (!date) return '—'
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

export default async function AdminProgressOverviewPage() {
  const [kpis, engaged, topCourses, recent] = await Promise.all([
    adminProgressService.getOverviewKpis(),
    adminProgressService.getMostEngagedMembers(5),
    adminProgressService.getTopCourses(5),
    adminProgressService.getRecentCompletions(10),
  ])

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          size="sm"
          title="Active members"
          value={kpis.activeMembers}
          icon={Users}
          tone="info"
        />
        <StatCard
          size="sm"
          title="Total enrollments"
          value={kpis.totalEnrollments}
          icon={GraduationCap}
          tone="neutral"
        />
        <StatCard
          size="sm"
          title="Avg progress"
          value={`${kpis.avgProgressPercent}%`}
          icon={TrendingUp}
          tone="brand"
          description="Active enrollments"
        />
        <StatCard
          size="sm"
          title="Completion rate"
          value={`${kpis.completionRate}%`}
          icon={CheckCircle2}
          tone="success"
          description="Completed / non-revoked"
        />
        <StatCard
          size="sm"
          title="Weekly active"
          value={kpis.weeklyActiveLearners}
          icon={Zap}
          tone="violet"
          description="Last 7 days"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Most engaged members"
          description="Top 5 by lessons completed in the last 30 days."
        >
          {engaged.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No engagement yet"
              description="Member lesson completions will surface here."
            />
          ) : (
            <ul className="divide-y">
              {engaged.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <Avatar>
                    {m.avatarUrl ? <AvatarImage src={m.avatarUrl} /> : null}
                    <AvatarFallback>
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
                      Last activity {relativeTime(m.lastActivity)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums">
                      {m.completedLessons}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      lessons · 30d
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Top courses"
          description="Ranked by total non-revoked enrollments."
        >
          {topCourses.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="No enrollments yet"
              description="Once members enroll, their courses will rank here."
            />
          ) : (
            <ul className="divide-y">
              {topCourses.map((c) => (
                <li
                  key={c.id}
                  className="space-y-2 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/admin/courses/${c.id}`}
                      className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                    >
                      {c.title}
                    </Link>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {c.enrolledCount} enrolled · {c.completedCount}{' '}
                      completed
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress
                      value={c.avgProgressPercent}
                      className="h-1.5 flex-1"
                    />
                    <span
                      className={cn(
                        'shrink-0 text-xs tabular-nums',
                        c.completionRate >= 50
                          ? 'text-success'
                          : 'text-muted-foreground',
                      )}
                    >
                      {c.completionRate}%
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Recent completions"
        description="The last 10 members to finish a course."
      >
        {recent.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No completions yet"
            description="When members finish courses, they'll show up here."
          />
        ) : (
          <ul className="divide-y">
            {recent.map((r) => (
              <li
                key={r.enrollmentId}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
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
                  <p className="truncate text-sm">
                    <span className="font-medium">
                      {r.user.name ?? r.user.email.split('@')[0]}
                    </span>{' '}
                    <span className="text-muted-foreground">completed</span>{' '}
                    <Link
                      href={`/admin/courses/${r.course.id}`}
                      className="font-medium hover:underline"
                    >
                      {r.course.title}
                    </Link>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {relativeTime(r.completedAt)}
                  </p>
                </div>
                <CheckCircle2 className="size-4 shrink-0 text-success" />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}

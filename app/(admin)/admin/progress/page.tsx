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
import { getInitials, relativeTime } from '@/lib/format'
import { adminProgressService } from '@/lib/services/admin-progress-service'

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
            <ul className="-mx-3 divide-y">
              {engaged.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/admin/progress/members/${m.id}`}
                    className="flex items-center gap-3 rounded-md px-3 py-3 transition-colors hover:bg-muted/40"
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
                  </Link>
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
                      href={`/admin/progress/courses/${c.id}`}
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
          <ul className="-mx-3 divide-y">
            {recent.map((r) => (
              <li key={r.enrollmentId}>
                <Link
                  href={`/admin/progress/members/${r.user.id}`}
                  className="flex items-center gap-3 rounded-md px-3 py-3 transition-colors hover:bg-muted/40"
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
                      <span className="font-medium">{r.course.title}</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {relativeTime(r.completedAt)}
                    </p>
                  </div>
                  <CheckCircle2 className="size-4 shrink-0 text-success" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}

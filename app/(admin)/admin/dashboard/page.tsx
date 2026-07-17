import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  Clock,
  FilePen,
  GraduationCap,
  Megaphone,
  Plus,
  Ticket,
  UserPlus,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react'

import { requireAdmin } from '@/lib/auth/get-user'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatStrip,
  StatusBadge,
  type StatStripCell,
} from '@/components/shared'
import { getInitials, relativeTime } from '@/lib/format'
import { prisma } from '@/lib/prisma'
import { adminProgressService } from '@/lib/services/admin-progress-service'
import { memberTenantScope } from '@/lib/tenancy/request-company'
import { CompletionsChart } from '@/components/admin/dashboard/completions-chart'
import { TopCoursesChart } from '@/components/admin/dashboard/top-courses-chart'
import { cn } from '@/lib/utils'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

interface AttentionItem {
  count: number
  label: string
  href: string
  icon: LucideIcon
  tone: 'warning' | 'danger' | 'neutral'
}

export default async function AdminDashboardPage() {
  // Current admin — used to filter the "My tasks" widget below.
  const currentUser = await requireAdmin()
  const now = Date.now()
  const stuckEnrolledCutoff = new Date(now - FOURTEEN_DAYS_MS)
  const stuckInactivityCutoff = new Date(now - SEVEN_DAYS_MS)

  // Users are a global table, so the Prisma tenancy extension does
  // NOT auto-scope them. Every user.count / user.findMany on this
  // dashboard has to opt in via memberTenantScope() — otherwise the
  // "Members" card reads the platform-wide count and "Newest members"
  // leaks other tenants' users into the sidebar panel.
  const tenantScope = await memberTenantScope()

  const [
    membersTotal,
    membersActive,
    coursesTotal,
    coursesPublished,
    draftCourses,
    unpublishedLessons,
    pendingEnrollments,
    activeEnrollments,
    stuckLearnersCount,
    recentMembers,
    recentCompletions,
    completionsByWeek,
    topCourses,
  ] = await Promise.all([
    prisma.user.count({
      where: { role: 'MEMBER', deletedAt: null, ...tenantScope },
    }),
    prisma.user.count({
      where: {
        role: 'MEMBER',
        isActive: true,
        deletedAt: null,
        ...tenantScope,
      },
    }),
    prisma.course.count({ where: { deletedAt: null } }),
    prisma.course.count({ where: { status: 'PUBLISHED', deletedAt: null } }),
    prisma.course.count({ where: { status: 'DRAFT', deletedAt: null } }),
    prisma.lesson.count({
      where: { status: { in: ['DRAFT', 'PROCESSING'] }, deletedAt: null },
    }),
    prisma.enrollment.count({ where: { status: 'PENDING' } }),
    prisma.enrollment.count({ where: { status: 'ACTIVE' } }),
    // Same predicate as adminProgressService.getStuckLearners, kept
    // inline so the count fits in this same Promise.all without an
    // extra service hop.
    prisma.enrollment.count({
      where: {
        // ACTIVE excludes COMPLETED since the enum split; keep the
        // predicate slim to match adminProgressService.getStuckLearners.
        status: 'ACTIVE',
        progressPercent: { gt: 0 },
        enrolledAt: { lt: stuckEnrolledCutoff },
        OR: [
          { lastAccessedAt: { lt: stuckInactivityCutoff } },
          { lastAccessedAt: null },
        ],
      },
    }),
    prisma.user.findMany({
      where: { role: 'MEMBER', deletedAt: null, ...tenantScope },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        isActive: true,
        lastLoginAt: true,
      },
    }),
    adminProgressService.getRecentCompletions(5, 'all'),
    adminProgressService.getCompletionsByWeek(12),
    adminProgressService.getTopCourses(5, 'all'),
  ])

  // "My tasks" widget — top 5 open tasks assigned to the current
  // admin, plus a total count for the section header. Overdue rows
  // sort first (via a null-aware ORDER BY on dueDate); ties break
  // by createdAt so newer work surfaces. The task tracker is
  // multi-assignee, so we filter on the join table.
  const myOpenTasksWhere = {
    deletedAt: null,
    archivedAt: null,
    status: { isTerminal: false },
    assignees: { some: { userId: currentUser.id } },
  } as const
  const [myOpenTasks, myOpenTaskTotal, myOverdueCount] = await Promise.all([
    prisma.task.findMany({
      where: myOpenTasksWhere,
      orderBy: [
        { dueDate: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      take: 5,
      select: {
        id: true,
        title: true,
        priority: true,
        dueDate: true,
        status: { select: { name: true, color: true, isTerminal: true } },
      },
    }),
    prisma.task.count({ where: myOpenTasksWhere }),
    prisma.task.count({
      where: {
        ...myOpenTasksWhere,
        dueDate: { lt: new Date() },
      },
    }),
  ])

  const cells: StatStripCell[] = [
    {
      label: 'Members',
      value: membersTotal,
      icon: Users,
      description: `${membersActive} active`,
    },
    {
      label: 'Courses',
      value: coursesTotal,
      icon: GraduationCap,
      description:
        draftCourses > 0
          ? `${coursesPublished} published · ${draftCourses} draft`
          : `${coursesPublished} published`,
    },
    {
      label: 'Active enrollments',
      value: activeEnrollments,
      icon: Ticket,
      description: 'Open Progress Tracker',
    },
    {
      label: 'Stuck learners',
      value: stuckLearnersCount,
      icon: AlertTriangle,
      description: stuckLearnersCount > 0 ? 'Needs a nudge' : 'All clear',
      valueClassName:
        stuckLearnersCount > 0 ? 'text-amber-600 dark:text-amber-400' : undefined,
    },
  ]

  const attention: AttentionItem[] = (
    [
      {
        count: pendingEnrollments,
        label: `${plural(pendingEnrollments, 'enrollment', 'enrollments')} awaiting activation`,
        href: '/admin/members',
        icon: Clock,
        tone: 'warning',
      },
      {
        count: stuckLearnersCount,
        label: `${plural(stuckLearnersCount, 'learner', 'learners')} stalled for 7+ days`,
        href: '/admin/progress',
        icon: AlertTriangle,
        tone: 'danger',
      },
      {
        count: draftCourses,
        label: `${plural(draftCourses, 'course', 'courses')} still in draft`,
        href: '/admin/courses',
        icon: FilePen,
        tone: 'neutral',
      },
      {
        count: unpublishedLessons,
        label: `${plural(unpublishedLessons, 'lesson', 'lessons')} not yet ready`,
        href: '/admin/courses',
        icon: Video,
        tone: 'neutral',
      },
      {
        count: myOverdueCount,
        label: `${plural(myOverdueCount, 'task', 'tasks')} overdue on you`,
        href: '/admin/tasks',
        icon: CheckSquare,
        tone: 'danger',
      },
    ] satisfies AttentionItem[]
  ).filter((a) => a.count > 0)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dashboard"
        description="A quick pulse on your platform and what needs your attention."
      />

      <Link
        href="/admin/progress"
        aria-label="Open Progress Tracker"
        className="block focus:outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <StatStrip cells={cells} />
      </Link>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard
          title="Completions over time"
          description="Course completions per week, last 12 weeks."
        >
          <CompletionsChart data={completionsByWeek} />
        </SectionCard>
        <SectionCard
          title="Top courses by enrollment"
          description="The five courses pulling the most active interest."
        >
          {topCourses.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="No enrollments yet"
              description="Once members enroll, the busiest courses rank here."
            />
          ) : (
            <TopCoursesChart courses={topCourses} />
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SectionCard
            title="Needs attention"
            description="Items that block publishing, onboarding, or learner momentum."
            flush
          >
            {attention.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="You're all caught up"
                description="No pending enrollments, stuck learners, drafts, or unpublished lessons."
              />
            ) : (
              <ul className="divide-y">
                {attention.map((a) => (
                  <li key={a.label}>
                    <Link
                      href={a.href}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <span
                        className={
                          a.tone === 'danger'
                            ? 'flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive'
                            : a.tone === 'warning'
                              ? 'flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning'
                              : 'flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground'
                        }
                      >
                        <a.icon className="size-4" />
                      </span>
                      <p className="flex-1 text-sm">
                        <span className="font-semibold tabular-nums">
                          {a.count}
                        </span>{' '}
                        {a.label}
                      </p>
                      <ArrowRight className="size-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Recent completions"
            description="The latest course completions across the platform."
            action={
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/admin/progress" />}
              >
                Open tracker
              </Button>
            }
            flush
          >
            {recentCompletions.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No completions yet"
                description="When members finish courses, the latest will surface here."
              />
            ) : (
              <ul className="divide-y">
                {recentCompletions.map((r) => (
                  <li key={r.enrollmentId}>
                    <Link
                      href={`/admin/progress/members/${r.user.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50"
                    >
                      <Avatar className="size-8">
                        {r.user.avatarUrl ? (
                          <AvatarImage src={r.user.avatarUrl} />
                        ) : null}
                        <AvatarFallback className="text-[10px]">
                          {getInitials(r.user.name, r.user.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          <span className="font-medium">
                            {r.user.name ?? r.user.email.split('@')[0]}
                          </span>{' '}
                          <span className="text-muted-foreground">
                            completed
                          </span>{' '}
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

        <div className="space-y-4">
          <SectionCard title="Quick actions">
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="justify-start"
                render={<Link href="/admin/courses/new" />}
              >
                <Plus />
                Create a course
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                render={<Link href="/admin/announcements" />}
              >
                <Megaphone />
                Post an announcement
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                render={<Link href="/admin/members" />}
              >
                <UserPlus />
                Invite a member
              </Button>
            </div>
          </SectionCard>

          <SectionCard
            title={`My tasks (${myOpenTaskTotal})`}
            description={
              myOverdueCount > 0
                ? `${myOverdueCount} overdue`
                : 'Assigned to you, open'
            }
            action={
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/admin/tasks" />}
              >
                All
              </Button>
            }
            flush
          >
            {myOpenTasks.length === 0 ? (
              <EmptyState
                icon={CheckSquare}
                title="Nothing on your plate"
                description="Tasks assigned to you show up here."
              />
            ) : (
              <ul className="divide-y">
                {myOpenTasks.map((t) => {
                  const overdue =
                    t.dueDate !== null &&
                    t.dueDate.getTime() < Date.now() &&
                    !t.status.isTerminal
                  return (
                    <li key={t.id}>
                      <Link
                        href={`/admin/tasks?task=${t.id}`}
                        className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50"
                      >
                        <span
                          className="mt-0.5 size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: t.status.color }}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {t.title}
                          </p>
                          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <span>{t.status.name}</span>
                            {t.dueDate ? (
                              <>
                                <span aria-hidden>·</span>
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-0.5',
                                    overdue && 'font-medium text-rose-600',
                                  )}
                                >
                                  <CalendarDays
                                    className="size-3"
                                    aria-hidden
                                  />
                                  {relativeTime(t.dueDate)}
                                </span>
                              </>
                            ) : null}
                          </p>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Newest members"
            action={
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/admin/members" />}
              >
                All
              </Button>
            }
            flush
          >
            {recentMembers.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No members yet"
                description="Invited members will show up here as soon as they accept."
              />
            ) : (
              <ul className="divide-y">
                {recentMembers.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    <Avatar>
                      {m.avatarUrl ? <AvatarImage src={m.avatarUrl} /> : null}
                      <AvatarFallback>
                        {getInitials(m.name, m.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {m.name ?? m.email.split('@')[0]}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.lastLoginAt
                          ? `Active ${relativeTime(m.lastLoginAt)}`
                          : 'Not yet active'}
                      </p>
                    </div>
                    <StatusBadge status={m.isActive ? 'ACTIVE' : 'PAUSED'} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  )
}

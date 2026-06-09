import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
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

import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/shared'
import { prisma } from '@/lib/prisma'

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

function relativeTime(date: Date | null): string {
  if (!date) return 'Not yet active'
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

interface AttentionItem {
  count: number
  label: string
  href: string
  icon: LucideIcon
}

export default async function AdminDashboardPage() {
  const [
    members,
    courses,
    published,
    announcements,
    draftCourses,
    unpublishedLessons,
    pendingEnrollments,
    activeEnrollments,
    recentMembers,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'MEMBER', deletedAt: null } }),
    prisma.course.count({ where: { deletedAt: null } }),
    prisma.course.count({ where: { status: 'PUBLISHED', deletedAt: null } }),
    prisma.announcement.count({ where: { deletedAt: null } }),
    prisma.course.count({ where: { status: 'DRAFT', deletedAt: null } }),
    prisma.lesson.count({
      where: { status: { in: ['DRAFT', 'PROCESSING'] }, deletedAt: null },
    }),
    prisma.enrollment.count({ where: { status: 'PENDING' } }),
    prisma.enrollment.count({ where: { status: 'ACTIVE' } }),
    prisma.user.findMany({
      where: { role: 'MEMBER', deletedAt: null },
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
  ])

  const attention: AttentionItem[] = [
    {
      count: pendingEnrollments,
      label: `${plural(pendingEnrollments, 'enrollment', 'enrollments')} awaiting activation`,
      href: '/admin/members',
      icon: Clock,
    },
    {
      count: draftCourses,
      label: `${plural(draftCourses, 'course', 'courses')} still in draft`,
      href: '/admin/courses',
      icon: FilePen,
    },
    {
      count: unpublishedLessons,
      label: `${plural(unpublishedLessons, 'lesson', 'lessons')} not yet ready`,
      href: '/admin/courses',
      icon: Video,
    },
  ].filter((a) => a.count > 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="A quick pulse on your platform and what needs your attention."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Members" value={members} icon={Users} />
        <StatCard
          title="Courses"
          value={courses}
          icon={GraduationCap}
          description={`${published} published`}
        />
        <StatCard
          title="Active enrollments"
          value={activeEnrollments}
          icon={Ticket}
        />
        <StatCard
          title="Announcements"
          value={announcements}
          icon={Megaphone}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SectionCard title="Needs attention" flush>
            {attention.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="You're all caught up"
                description="No pending enrollments, drafts, or unpublished lessons."
              />
            ) : (
              <ul className="divide-y">
                {attention.map((a) => (
                  <li key={a.label}>
                    <Link
                      href={a.href}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
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

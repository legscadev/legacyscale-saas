import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle2,
  GraduationCap,
  Sparkles,
  TrendingUp,
  Users as UsersIcon,
} from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/shared'
import { MemberEnrollmentsTable } from '@/components/admin/progress/member-enrollments-table'
import { fmtDate, getInitials } from '@/lib/format'
import { adminProgressService } from '@/lib/services/admin-progress-service'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminProgressMemberDetailPage({
  params,
}: PageProps) {
  const { id } = await params
  const detail = await adminProgressService.getMemberProgress(id)
  if (!detail) notFound()

  const { user, kpis, enrollments } = detail

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2"
        render={<Link href="/admin/progress/members" />}
      >
        <ArrowLeft />
        Back to members
      </Button>

      <SectionCard>
        <div className="flex items-start gap-4">
          <Avatar className="size-14">
            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} /> : null}
            <AvatarFallback className="text-base">
              {getInitials(user.name, user.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold tracking-tight">
                {user.name ?? user.email.split('@')[0]}
              </h2>
              <StatusBadge status={user.role} />
              {!user.isActive ? <StatusBadge status="PAUSED" /> : null}
            </div>
            <p className="truncate text-sm text-muted-foreground">
              {user.email}
            </p>
            <p className="text-xs text-muted-foreground">
              Joined {fmtDate(user.createdAt)} · Last login{' '}
              {fmtDate(user.lastLoginAt)}
            </p>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          size="sm"
          title="Enrollments"
          value={kpis.totalEnrollments}
          icon={GraduationCap}
          tone="neutral"
        />
        <StatCard
          size="sm"
          title="Completed"
          value={kpis.completedCourses}
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
          title="Lessons · 30d"
          value={kpis.completedLessonsLast30d}
          icon={Sparkles}
          tone="violet"
          description="Last 30 days"
        />
      </div>

      <SectionCard
        title="Enrollments"
        description="Click a course to expand its chapter + lesson breakdown."
        flush
      >
        {enrollments.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={UsersIcon}
              title="No enrollments"
              description="This member hasn't enrolled in any courses yet."
            />
          </div>
        ) : (
          <MemberEnrollmentsTable userId={user.id} enrollments={enrollments} />
        )}
      </SectionCard>
    </div>
  )
}

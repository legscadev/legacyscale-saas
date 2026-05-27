import Link from "next/link"
import {
  ArrowRight,
  Clock,
  FilePen,
  Megaphone,
  Plus,
  UserPlus,
  Video,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { PageContainer } from "@/components/prototype/shared/page-container"
import { PageHeader } from "@/components/prototype/shared/page-header"
import { SectionCard } from "@/components/prototype/shared/section-card"
import { StatCard } from "@/components/prototype/shared/stat-card"
import { ActivityFeed } from "@/components/prototype/shared/activity-feed"
import { StatusBadge } from "@/components/prototype/shared/status-badge"
import { EmptyState } from "@/components/prototype/shared/empty-state"
import { CheckCircle2 } from "lucide-react"
import {
  adminActivity,
  adminKpis,
  courses,
  enrollments,
  initials,
  members,
  relativeTime,
} from "@/lib/prototype"

interface AttentionItem {
  count: number
  label: string
  href: string
  icon: LucideIcon
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

export default function AdminDashboard() {
  const recentMembers = members.slice(0, 5)

  const pending = enrollments.filter((e) => e.status === "PENDING").length
  const draftCourses = courses.filter((c) => c.status === "DRAFT").length
  const unpublishedLessons = courses
    .flatMap((c) => c.chapters)
    .flatMap((ch) => ch.lessons)
    .filter((l) => l.status !== "READY").length

  const attention: AttentionItem[] = [
    {
      count: pending,
      label: `${plural(pending, "enrollment", "enrollments")} awaiting activation`,
      href: "/prototype/admin/enrollments",
      icon: Clock,
    },
    {
      count: draftCourses,
      label: `${plural(draftCourses, "course", "courses")} still in draft`,
      href: "/prototype/admin/courses",
      icon: FilePen,
    },
    {
      count: unpublishedLessons,
      label: `${plural(unpublishedLessons, "lesson", "lessons")} not yet published`,
      href: "/prototype/admin/courses/course-1",
      icon: Video,
    },
  ].filter((a) => a.count > 0)

  return (
    <PageContainer size="wide">
      <PageHeader
        title="Overview"
        description="A quick pulse on your platform and what needs your attention."
        actions={
          <Button render={<Link href="/prototype/admin/courses/new" />}>
            <Plus />
            New course
          </Button>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {adminKpis.map((stat, i) => (
          <StatCard key={stat.label} stat={stat} index={i} />
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SectionCard title="Needs attention" flush>
            {attention.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="You're all caught up"
                description="No pending enrollments, drafts, or unpublished lessons."
                className="border-0"
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
                        </span>{" "}
                        {a.label}
                      </p>
                      <ArrowRight className="size-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Recent activity">
            <ActivityFeed items={adminActivity.slice(0, 6)} />
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Quick actions">
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="justify-start"
                render={<Link href="/prototype/admin/courses/new" />}
              >
                <Plus />
                Create a course
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                render={<Link href="/prototype/admin/announcements/new" />}
              >
                <Megaphone />
                Post an announcement
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                render={<Link href="/prototype/admin/members" />}
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
                render={<Link href="/prototype/admin/members" />}
              >
                All
              </Button>
            }
            flush
          >
            <ul className="divide-y">
              {recentMembers.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Avatar size="sm">
                    <AvatarFallback>{initials(m.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.lastLoginAt
                        ? `Active ${relativeTime(m.lastLoginAt)}`
                        : "Not yet active"}
                    </p>
                  </div>
                  <StatusBadge status={m.isActive ? "ACTIVE" : "REVOKED"} />
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  )
}

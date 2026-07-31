import Link from 'next/link'
import {
  Award,
  Bell,
  BookOpen,
  FileText,
  GraduationCap,
  Play,
} from 'lucide-react'

import { CourseCard, EmptyState } from '@/components/shared'
import { DashboardGreeting } from '@/components/student/dashboard-greeting'
import { DashboardTasksCard } from '@/components/student/dashboard-tasks-card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { requireActiveUser } from '@/lib/auth'
import { dashboardService } from '@/lib/services/dashboard-service'
import { studentTaskService } from '@/lib/services/student-task-service'
import { ANNOUNCEMENT_CATEGORY_LABELS } from '@/lib/validations/announcement'
import { cn, htmlToPlainText } from '@/lib/utils'

const RELATIVE_FMT = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' })

function formatRelative(date: Date): string {
  const diffMs = date.getTime() - Date.now()
  const diffMin = Math.round(diffMs / 60000)
  if (Math.abs(diffMin) < 60) return RELATIVE_FMT.format(diffMin, 'minute')
  const diffHr = Math.round(diffMin / 60)
  if (Math.abs(diffHr) < 24) return RELATIVE_FMT.format(diffHr, 'hour')
  const diffDay = Math.round(diffHr / 24)
  return RELATIVE_FMT.format(diffDay, 'day')
}

export default async function UserDashboardPage() {
  const user = await requireActiveUser()
  const [dash, tasks] = await Promise.all([
    dashboardService.getMemberDashboard(user.id),
    studentTaskService.listUpcoming(user.id, 5),
  ])
  const {
    stats,
    continueLearning,
    inProgressCourses,
    announcements,
    recentNotes,
    recentCertificates,
  } = dash

  const activeCount = inProgressCourses.length
  const subtitle =
    activeCount > 0
      ? `${activeCount} course${activeCount === 1 ? '' : 's'} in progress · ${stats.lessonsCompleted.toLocaleString()} lesson${stats.lessonsCompleted === 1 ? '' : 's'} completed`
      : 'Pick up a course to get started.'

  return (
    <div className="space-y-6">
      <DashboardGreeting name={user.name} subtitle={subtitle} />

      {/* Continue-learning hero */}
      {continueLearning ? (
        <Card variant="raised" className="gap-4 p-6">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            <Play className="size-3" aria-hidden />
            Continue where you left off
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 space-y-2">
              <p className="truncate text-lg font-semibold tracking-tight">
                {continueLearning.courseTitle}
              </p>
              <div className="flex items-center gap-3">
                <Progress
                  value={continueLearning.progressPercent}
                  className="h-1.5 max-w-xs"
                />
                <span className="text-xs tabular-nums text-muted-foreground">
                  {continueLearning.progressPercent}%
                </span>
              </div>
            </div>
            <Button
              size="lg"
              className="sm:shrink-0"
              render={<Link href={continueLearning.resumeHref} />}
            >
              {continueLearning.resumeLessonId
                ? 'Resume lesson'
                : 'Open course'}
              →
            </Button>
          </div>
        </Card>
      ) : null}

      {/* Stat strip — subtle, four counts on one row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatChip
          icon={GraduationCap}
          label="Enrolled"
          value={stats.enrolledCount}
        />
        <StatChip
          icon={BookOpen}
          label="Lessons done"
          value={stats.lessonsCompleted}
        />
        <StatChip icon={FileText} label="Notes" value={stats.notesCount} />
        <StatChip
          icon={Award}
          label="Certificates"
          value={stats.certificatesEarned}
        />
      </div>

      {/* Main / sidebar split — 3:2 on wide screens, stack on mobile */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Main column */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>My courses</CardTitle>
              <Link
                href="/courses"
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Browse all →
              </Link>
            </CardHeader>
            <CardContent>
              {inProgressCourses.length === 0 ? (
                <EmptyState
                  icon={GraduationCap}
                  tone="brand"
                  title="No courses yet"
                  description="When you're enrolled in a course, it'll show up here so you can pick up where you left off."
                >
                  <Link href="/courses" className={buttonVariants()}>
                    Browse courses
                  </Link>
                </EmptyState>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {inProgressCourses.map((course) => (
                    <CourseCard
                      key={course.id}
                      course={{
                        id: course.id,
                        title: course.title,
                        description: course.description,
                        thumbnailUrl: course.thumbnailUrl,
                        status: course.status,
                      }}
                      href={`/courses/${course.slug}`}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4" />
                Recent notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Take notes on a lesson and they'll surface here.
                </p>
              ) : (
                <ul className="divide-y">
                  {recentNotes.map((note) => (
                    <li key={note.id}>
                      <Link
                        href={`/courses/${note.courseSlug}/lessons/${note.lessonId}`}
                        className="block py-3 transition-colors first:pt-0 last:pb-0 hover:bg-muted/40"
                      >
                        <p className="line-clamp-2 text-sm leading-snug">
                          {note.preview || (
                            <span className="italic text-muted-foreground">
                              (empty note)
                            </span>
                          )}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          <span className="font-medium">{note.courseTitle}</span>
                          {' · '}
                          {note.lessonTitle}
                          {' · '}
                          <span className="tabular-nums">
                            {formatRelative(note.updatedAt)}
                          </span>
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar column */}
        <div className="space-y-6">
          <DashboardTasksCard initialTasks={tasks} />

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Bell className="size-4" />
                Announcements
              </CardTitle>
              <Link
                href="/announcements"
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                View all →
              </Link>
            </CardHeader>
            <CardContent>
              {announcements.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No announcements yet — check back later.
                </p>
              ) : (
                <ul className="divide-y">
                  {announcements.slice(0, 4).map((a) => {
                    const preview = htmlToPlainText(a.body)
                    const when = a.publishedAt ?? a.createdAt
                    return (
                      <li key={a.id}>
                        <Link
                          href={`/announcements/${a.id}`}
                          className="block py-3 transition-colors first:pt-0 last:pb-0 hover:bg-muted/40"
                        >
                          <div className="flex items-center gap-2">
                            {a.isUnread ? (
                              <span
                                aria-hidden
                                className="size-1.5 shrink-0 rounded-full bg-primary"
                              />
                            ) : null}
                            <span
                              className={cn(
                                'truncate text-sm',
                                a.isUnread
                                  ? 'font-semibold'
                                  : 'font-medium text-muted-foreground',
                              )}
                            >
                              {a.title}
                            </span>
                            <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">
                              {formatRelative(when)}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                            <span className="font-medium uppercase tracking-wider">
                              {ANNOUNCEMENT_CATEGORY_LABELS[a.category]}
                            </span>
                            {preview ? ` · ${preview}` : ''}
                          </p>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Award className="size-4" />
                Certificates
              </CardTitle>
              <Link
                href="/certificates"
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                View all →
              </Link>
            </CardHeader>
            <CardContent>
              {recentCertificates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Complete a course module to earn your first certificate.
                </p>
              ) : (
                <ul className="space-y-2">
                  {recentCertificates.map((cert) => (
                    <li
                      key={cert.id}
                      className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2"
                    >
                      <Award className="size-4 shrink-0 text-primary" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {cert.courseTitle}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          Earned {formatRelative(cert.issuedAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ============================================
// Small helpers
// ============================================

function StatChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="text-lg font-semibold tabular-nums leading-tight">
          {value.toLocaleString()}
        </p>
      </div>
    </div>
  )
}

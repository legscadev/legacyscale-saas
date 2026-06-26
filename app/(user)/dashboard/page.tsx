import Link from 'next/link'
import {
  ArrowRight,
  Bell,
  BookOpen,
  FileText,
  GraduationCap,
  Play,
} from 'lucide-react'

import {
  PageHeader,
  StatCard,
  CourseCard,
  EmptyState,
} from '@/components/shared'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { requireActiveUser } from '@/lib/auth'
import { dashboardService } from '@/lib/services/dashboard-service'
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
  const { stats, continueLearning, inProgressCourses, announcements } =
    await dashboardService.getMemberDashboard(user.id)

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Track your learning progress" />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Courses Enrolled"
          value={stats.enrolledCount}
          icon={GraduationCap}
          tone="brand"
        />
        <StatCard
          title="Lessons Completed"
          value={stats.lessonsCompleted}
          icon={BookOpen}
          tone="success"
        />
        <StatCard
          title="Notes Taken"
          value={stats.notesCount}
          icon={FileText}
          tone="info"
        />
      </div>

      {continueLearning ? (
        <Card variant="raised" className="gap-4 p-6">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            <Play className="size-3.5" />
            Resume where you left off
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
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
              <ArrowRight />
            </Button>
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Continue Learning</CardTitle>
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            <Bell className="size-4" />
            Recent announcements
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
              {announcements.map((a) => {
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
    </div>
  )
}

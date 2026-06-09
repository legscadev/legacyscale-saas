import { BookOpen, CheckCircle2, GraduationCap, PlayCircle } from 'lucide-react'

import { PageHeader, EmptyState, StatCard } from '@/components/shared'
import { CourseRow } from '@/components/member/course-row'
import { ContinueHero } from '@/components/member/continue-hero'
import { requireActiveUser } from '@/lib/auth'
import {
  memberCourseService,
  type MemberCatalogCourse,
} from '@/lib/services/member-course-service'

// "Recently added" surfaces anything published within this window.
const RECENT_WINDOW_DAYS = 30

export default async function UserCoursesPage() {
  const user = await requireActiveUser()
  const courses = await memberCourseService.listCatalog(user.id)

  if (courses.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Courses" description="Continue where you left off" />
        <EmptyState
          icon={BookOpen}
          title="No courses available yet"
          description="Your courses will appear here as soon as they're published."
        />
      </div>
    )
  }

  const inProgress = sortByLastAccessed(
    courses.filter(
      (c) => c.progress != null && c.progress.percent > 0 && c.progress.percent < 100,
    ),
  )
  const completed = sortByLastAccessed(
    courses.filter((c) => c.progress != null && c.progress.percent === 100),
  )
  const recentCutoff = Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000
  const recentlyAdded = courses
    .filter(
      (c) =>
        c.publishedAt != null &&
        c.publishedAt.getTime() >= recentCutoff &&
        (c.progress == null || c.progress.percent === 0),
    )
    .sort((a, b) => {
      const at = a.publishedAt?.getTime() ?? 0
      const bt = b.publishedAt?.getTime() ?? 0
      return bt - at
    })

  const stats = {
    total: courses.length,
    inProgress: inProgress.length,
    completed: completed.length,
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Courses"
        description="Your enrolled programs and everything available to you."
      />

      <StatsStrip stats={stats} />

      <div className="space-y-10">
        {inProgress.length > 0 ? (
          <>
            <ContinueHero course={inProgress[0]!} />
            {inProgress.length > 1 ? (
              <CourseRow
                title="Also in progress"
                subtitle="Other programs you've started"
                courses={inProgress.slice(1)}
              />
            ) : null}
          </>
        ) : null}

        {recentlyAdded.length > 0 ? (
          <CourseRow
            title="New this month"
            subtitle="Recently published"
            courses={recentlyAdded}
          />
        ) : null}

        <CourseRow
          title="All courses"
          subtitle="Everything available to you"
          courses={courses}
        />

        {completed.length > 0 ? (
          <CourseRow
            title="Completed"
            subtitle="Programs you've finished"
            courses={completed}
          />
        ) : null}
      </div>
    </div>
  )
}

function StatsStrip({
  stats,
}: {
  stats: { total: number; inProgress: number; completed: number }
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard
        title="Courses available"
        value={stats.total}
        icon={GraduationCap}
        tone="brand"
      />
      <StatCard
        title="In progress"
        value={stats.inProgress}
        icon={PlayCircle}
        tone="warning"
      />
      <StatCard
        title="Completed"
        value={stats.completed}
        icon={CheckCircle2}
        tone="success"
      />
    </div>
  )
}

function sortByLastAccessed(list: MemberCatalogCourse[]): MemberCatalogCourse[] {
  return [...list].sort((a, b) => {
    const ax =
      a.enrollment?.lastAccessedAt?.getTime() ??
      a.enrollment?.enrolledAt?.getTime() ??
      0
    const bx =
      b.enrollment?.lastAccessedAt?.getTime() ??
      b.enrollment?.enrolledAt?.getTime() ??
      0
    return bx - ax
  })
}

import { BookOpen } from 'lucide-react'

import { PageHeader, EmptyState } from '@/components/shared'
import { MemberCourseCard } from '@/components/member/course-card'
import { requireActiveUser } from '@/lib/auth'
import { memberCourseService } from '@/lib/services/member-course-service'

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

  // Split into "in progress / available" so the grid leads with what
  // members are actively working through.
  const inProgress = courses.filter(
    (c) => c.progress != null && c.progress.percent > 0,
  )
  const available = courses.filter(
    (c) => c.progress == null || c.progress.percent === 0,
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Courses"
        description="Your enrolled programs and everything available to you."
      />

      {inProgress.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground">
            In progress
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {inProgress.map((c, i) => (
              <MemberCourseCard key={c.id} course={c} index={i} />
            ))}
          </div>
        </section>
      ) : null}

      {available.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {inProgress.length > 0 ? 'Explore more' : 'Available courses'}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((c, i) => (
              <MemberCourseCard key={c.id} course={c} index={i} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

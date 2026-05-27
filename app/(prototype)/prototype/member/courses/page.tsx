import { PageContainer } from "@/components/prototype/shared/page-container"
import { PageHeader } from "@/components/prototype/shared/page-header"
import { CourseCard } from "@/components/prototype/member/course-card"
import { courses } from "@/lib/prototype"

// Mock: current member is 38% through the flagship; others are discoverable.
const PROGRESS: Record<string, number> = { "course-1": 38 }

export default function MemberCourses() {
  const published = courses.filter((c) => c.status === "PUBLISHED")
  const inProgress = published.filter((c) => PROGRESS[c.id] !== undefined)
  const explore = published.filter((c) => PROGRESS[c.id] === undefined)

  return (
    <PageContainer size="wide">
      <PageHeader
        title="My Courses"
        description="Your enrolled programs and everything available to you."
      />

      <section className="mt-6 space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground">
          In progress
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {inProgress.map((c, i) => (
            <CourseCard
              key={c.id}
              course={c}
              progressPercent={PROGRESS[c.id]}
              index={i}
            />
          ))}
        </div>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Explore more
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {explore.map((c, i) => (
            <CourseCard key={c.id} course={c} index={i} />
          ))}
        </div>
      </section>
    </PageContainer>
  )
}

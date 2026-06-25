import Link from 'next/link'
import { BookOpen, FileText, GraduationCap } from 'lucide-react'
import {
  PageHeader,
  StatCard,
  CourseCard,
  EmptyState,
} from '@/components/shared'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function UserDashboardPage() {
  const user = await requireActiveUser()

  const [enrolledCount, lessonsCompleted, notesCount, enrollments] =
    await Promise.all([
      prisma.enrollment.count({
        // Both ACTIVE and COMPLETED count as "enrolled" for this stat
        // — a finished course is still part of the member's library.
        where: { userId: user.id, status: { in: ['ACTIVE', 'COMPLETED'] } },
      }),
      prisma.lessonProgress.count({
        where: { userId: user.id, completed: true },
      }),
      prisma.note.count({ where: { userId: user.id } }),
      prisma.enrollment.findMany({
        // "Continue learning" is intentionally ACTIVE-only — completed
        // courses live on the catalog if the member wants to revisit.
        where: { userId: user.id, status: 'ACTIVE' },
        include: { course: true },
        orderBy: { enrolledAt: 'desc' },
        take: 6,
      }),
    ])

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Track your learning progress" />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Courses Enrolled"
          value={enrolledCount}
          icon={GraduationCap}
          tone="brand"
        />
        <StatCard
          title="Lessons Completed"
          value={lessonsCompleted}
          icon={BookOpen}
          tone="success"
        />
        <StatCard
          title="Notes Taken"
          value={notesCount}
          icon={FileText}
          tone="info"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Continue Learning</CardTitle>
        </CardHeader>
        <CardContent>
          {enrollments.length === 0 ? (
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
              {enrollments.map(({ course }) => (
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
    </div>
  )
}

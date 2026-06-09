import { BookOpen, FileText, GraduationCap } from 'lucide-react'
import {
  PageHeader,
  StatCard,
  CourseCard,
} from '@/components/shared'
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
        where: { userId: user.id, status: 'ACTIVE' },
      }),
      prisma.lessonProgress.count({
        where: { userId: user.id, completed: true },
      }),
      prisma.note.count({ where: { userId: user.id } }),
      prisma.enrollment.findMany({
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
        />
        <StatCard
          title="Lessons Completed"
          value={lessonsCompleted}
          icon={BookOpen}
        />
        <StatCard title="Notes Taken" value={notesCount} icon={FileText} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Continue Learning</CardTitle>
        </CardHeader>
        <CardContent>
          {enrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You&apos;re not enrolled in any courses yet.
            </p>
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
                  href={`/courses/${course.id}`}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

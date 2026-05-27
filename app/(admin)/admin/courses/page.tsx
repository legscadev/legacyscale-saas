import { GraduationCap, Plus } from 'lucide-react'
import { PageHeader, EmptyState, CourseCard } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { prisma } from '@/lib/prisma'

export default async function AdminCoursesPage() {
  const courses = await prisma.course.findMany({
    where: { deletedAt: null },
    orderBy: { orderIndex: 'asc' },
    include: { _count: { select: { chapters: true } } },
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Courses" description="Manage your course content">
        <Button>
          <Plus className="h-4 w-4" />
          Create Course
        </Button>
      </PageHeader>

      {courses.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No courses yet"
          description="Create your first course to get started."
        >
          <Button>
            <Plus className="h-4 w-4" />
            Create Course
          </Button>
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={{
                id: course.id,
                title: course.title,
                description: course.description,
                thumbnailUrl: course.thumbnailUrl,
                status: course.status,
                chaptersCount: course._count.chapters,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

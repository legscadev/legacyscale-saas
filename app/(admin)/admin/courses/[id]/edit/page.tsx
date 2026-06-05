import { notFound } from 'next/navigation'

import { requireAdmin } from '@/lib/auth/get-user'
import { courseService } from '@/lib/services/course-service'
import { PageHeader } from '@/components/shared'
import { CourseForm } from '@/components/admin/courses/course-form'
import { CourseDeleteButton } from '@/components/admin/courses/course-delete-button'
import { updateCourseAction } from '../../actions'

interface EditCoursePageProps {
  params: Promise<{ id: string }>
}

export default async function EditCoursePage({ params }: EditCoursePageProps) {
  await requireAdmin()
  const { id } = await params

  const course = await courseService.getById(id)
  if (!course) notFound()

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit ${course.title}`}
        description="Changes are saved when you click Save."
      />
      <CourseForm
        mode="edit"
        submitLabel="Save changes"
        defaults={{
          title: course.title,
          description: course.description,
          thumbnailUrl: course.thumbnailUrl,
          status: course.status,
          accessDays: course.accessDays,
          isFree: course.isFree,
        }}
        onSubmit={updateCourseAction.bind(null, id)}
        destructiveAction={
          <CourseDeleteButton courseId={id} courseTitle={course.title} />
        }
      />
    </div>
  )
}

import { requireAdmin } from '@/lib/auth/get-user'
import { PageHeader } from '@/components/shared'
import { CourseForm } from '@/components/admin/courses/course-form'
import { createCourseAction } from '../actions'

export default async function NewCoursePage() {
  await requireAdmin()

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="New course"
        description="Set up the shell here. You'll add chapters and lessons on the next screen."
      />
      <CourseForm
        mode="create"
        submitLabel="Create course"
        onSubmit={createCourseAction}
      />
    </div>
  )
}

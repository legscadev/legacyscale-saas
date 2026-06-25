import { requireAdmin } from '@/lib/auth/get-user'
import { PageHeader } from '@/components/shared'
import { CourseForm } from '@/components/admin/courses/course-form'
import { categoryService } from '@/lib/services/category-service'
import { createCourseAction } from '../actions'

export default async function NewCoursePage() {
  await requireAdmin()

  const categories = await categoryService.list()

  return (
    <div className="space-y-6">
      <PageHeader
        title="New course"
        description="Set up the shell here. You'll add chapters and lessons on the next screen."
      />
      <CourseForm
        mode="create"
        submitLabel="Create course"
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        onSubmit={createCourseAction}
      />
    </div>
  )
}

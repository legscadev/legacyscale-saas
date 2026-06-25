import { notFound } from 'next/navigation'

import { requireAdmin } from '@/lib/auth/get-user'
import { categoryService } from '@/lib/services/category-service'
import { courseService } from '@/lib/services/course-service'
import { PageHeader } from '@/components/shared'
import { CourseForm } from '@/components/admin/courses/course-form'
import { CourseDeleteButton } from '@/components/admin/courses/course-delete-button'
import { updateCourseAction } from '../../actions'

interface EditCoursePageProps {
  params: Promise<{ slug: string }>
}

export default async function EditCoursePage({ params }: EditCoursePageProps) {
  await requireAdmin()
  const { slug } = await params

  const [course, categories] = await Promise.all([
    courseService.getBySlug(slug),
    categoryService.list(),
  ])
  if (!course) notFound()
  const id = course.id

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit ${course.title}`}
        description="Changes are saved when you click Save."
      />
      <CourseForm
        mode="edit"
        submitLabel="Save changes"
        courseId={id}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        defaults={{
          title: course.title,
          slug: course.slug,
          description: course.description,
          thumbnailUrl: course.thumbnailUrl,
          coverImageUrl: course.coverImageUrl,
          certificateTemplateUrl: course.certificateTemplateUrl,
          status: course.status,
          accessDays: course.accessDays,
          isFree: course.isFree,
          audience: course.audience,
          categoryIds: course.categories.map((c) => c.id),
        }}
        onSubmit={updateCourseAction.bind(null, id)}
        destructiveAction={
          <CourseDeleteButton courseId={id} courseTitle={course.title} />
        }
      />
    </div>
  )
}

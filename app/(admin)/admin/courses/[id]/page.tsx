import { notFound } from 'next/navigation'

import { requireAdmin } from '@/lib/auth/get-user'
import { courseService } from '@/lib/services/course-service'
import { chapterService } from '@/lib/services/chapter-service'
import { CourseBuilder } from '@/components/admin/courses/course-builder'

interface CourseDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function CourseDetailPage({
  params,
}: CourseDetailPageProps) {
  await requireAdmin()
  const { id } = await params

  const course = await courseService.getById(id)
  if (!course) notFound()

  const chapters = await chapterService.list(id)

  return <CourseBuilder course={course} chapters={chapters} />
}

// Renders the interactive course builder for an existing course.
import { notFound } from "next/navigation"

import { CourseBuilder } from "@/components/prototype/courses/course-builder"
import { findCourse } from "@/lib/prototype"

export default async function CourseBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const course = findCourse(id)
  if (!course) notFound()

  return <CourseBuilder course={course} />
}

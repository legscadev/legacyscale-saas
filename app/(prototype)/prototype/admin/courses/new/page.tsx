import { CourseBuilder } from "@/components/prototype/courses/course-builder"
import type { Course } from "@/lib/prototype"

const blankCourse: Course = {
  id: "new",
  title: "",
  description: "",
  status: "DRAFT",
  orderIndex: 0,
  accessDays: null,
  chapters: [],
  lessonCount: 0,
  durationMinutes: 0,
  enrollmentCount: 0,
  completionRate: 0,
}

export default function NewCoursePage() {
  return <CourseBuilder course={blankCourse} mode="new" />
}

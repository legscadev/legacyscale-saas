'use server'

import { redirect } from 'next/navigation'

import { requireActiveUser } from '@/lib/auth'
import { memberCourseService } from '@/lib/services/member-course-service'
import { pickResumeLesson } from '@/lib/services/resume-picker'

interface BaseResult {
  ok: boolean
  error?: string
}

/**
 * Click "Start course" / "Continue learning" on a course detail page.
 * Ensures an ACTIVE enrollment row, then redirects into the player at
 * the lesson the user most recently left off on (or chapter 1 / lesson
 * 1 for a fresh enrollment). The player route itself is built in
 * Phase B; for now it'll render the Phase-B-pending stub.
 */
export async function startCourseAction(
  courseId: string,
): Promise<BaseResult> {
  const user = await requireActiveUser()

  const course = await memberCourseService.getById(user.id, courseId)
  if (!course) {
    return { ok: false, error: 'Course is unavailable' }
  }

  // Materialize an Enrollment row if missing. Also bumps
  // lastAccessedAt, so the catalog "Continue learning" hero stays
  // accurate across sessions.
  const enrollment = await memberCourseService.ensureEnrollment(
    user.id,
    courseId,
  )
  if (!enrollment) {
    return { ok: false, error: 'Could not enroll in this course' }
  }

  const allLessons = course.chapters.flatMap((c) => c.lessons)
  const next = pickResumeLesson(allLessons)
  if (!next) {
    return { ok: false, error: 'This course has no lessons yet' }
  }

  redirect(`/courses/${courseId}/lessons/${next.id}`)
}

/**
 * Form-action wrapper around startCourseAction so the "Resume" CTA on
 * the catalog hero can call it directly without a client component.
 * On success, startCourseAction throws via redirect; on failure we
 * land the user on the course detail page where the inline UI can
 * surface a more helpful state.
 */
export async function resumeCourseAction(formData: FormData): Promise<void> {
  const courseId = String(formData.get('courseId') ?? '')
  if (!courseId) redirect('/courses')
  await startCourseAction(courseId)
  redirect(`/courses/${courseId}`)
}

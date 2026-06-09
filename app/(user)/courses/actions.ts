'use server'

import { redirect } from 'next/navigation'

import { requireActiveUser } from '@/lib/auth'
import { memberCourseService } from '@/lib/services/member-course-service'

interface BaseResult {
  ok: boolean
  error?: string
}

/**
 * Click "Start course" / "Continue learning" on a course detail page.
 * Ensures an ACTIVE enrollment row, then redirects into the player at
 * the first incomplete lesson (or chapter 1 / lesson 1 for a fresh
 * enrollment). The player route itself is built in Phase B; for now
 * it'll render the Phase-B-pending stub.
 */
export async function startCourseAction(
  courseId: string,
): Promise<BaseResult> {
  const user = await requireActiveUser()

  const course = await memberCourseService.getById(user.id, courseId)
  if (!course) {
    return { ok: false, error: 'Course is unavailable' }
  }

  // Materialize an Enrollment row if missing. Idempotent.
  const enrollment = await memberCourseService.ensureEnrollment(
    user.id,
    courseId,
  )
  if (!enrollment) {
    return { ok: false, error: 'Could not enroll in this course' }
  }

  // Find the next lesson to land on. Prefer the first incomplete; fall
  // back to the very first lesson if everything's already done (or if
  // the user re-enters a completed course).
  const allLessons = course.chapters.flatMap((c) => c.lessons)
  if (allLessons.length === 0) {
    return { ok: false, error: 'This course has no lessons yet' }
  }
  const next =
    allLessons.find((l) => !l.progress?.completed) ?? allLessons[0]!

  redirect(`/courses/${courseId}/lessons/${next.id}`)
}

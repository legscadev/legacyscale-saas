'use server'

import { revalidatePath } from 'next/cache'

import { requireActiveUser } from '@/lib/auth'
import { memberCourseService } from '@/lib/services/member-course-service'

interface SetCompleteResult {
  ok: boolean
  progressPercent?: number
  completedCount?: number
  lessonsTotal?: number
  error?: string
}

/**
 * Toggle a lesson's completion state for the current user. Used by
 * the explicit "Mark complete" button and by the auto-complete fire
 * from the Mux player's `ended` event.
 *
 * Revalidates the player route + the course detail + the catalog so
 * the progress strip, curriculum checkmarks, and catalog progress
 * bar all reflect the change on next paint.
 */
export async function setLessonCompleteAction(
  lessonId: string,
  complete: boolean,
): Promise<SetCompleteResult> {
  try {
    const user = await requireActiveUser()
    const result = await memberCourseService.markLessonProgress(
      user.id,
      lessonId,
      complete,
    )

    revalidatePath(`/courses/${result.courseId}/lessons/${lessonId}`)
    revalidatePath(`/courses/${result.courseId}`)
    revalidatePath('/courses')

    return {
      ok: true,
      progressPercent: result.progressPercent,
      completedCount: result.completedCount,
      lessonsTotal: result.lessonsTotal,
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not update progress'
    return { ok: false, error: message }
  }
}

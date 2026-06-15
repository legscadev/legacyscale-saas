'use server'

import { revalidatePath, updateTag } from 'next/cache'

import { requireActiveUser } from '@/lib/auth'
import { memberCourseService } from '@/lib/services/member-course-service'
import { PROGRESS_TAG } from '@/lib/services/admin-progress-service'

interface SetCompleteResult {
  ok: boolean
  progressPercent?: number
  completedCount?: number
  lessonsTotal?: number
  error?: string
}

interface QuizBreakdownItem {
  questionId: string
  selected: number | null
  correctIndex: number
  explanation: string | null
}

interface SubmitQuizResult {
  ok: boolean
  attemptId?: string
  passed?: boolean
  score?: number
  total?: number
  passingScore?: number
  breakdown?: QuizBreakdownItem[]
  error?: string
}

interface DownloadUrlResult {
  ok: boolean
  url?: string
  filename?: string
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
    updateTag(PROGRESS_TAG)

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

/**
 * Submit a quiz attempt. The server scores it against the stored
 * correctIndex — the client never sees the answer key beforehand.
 * If the user passes, the lesson is auto-marked complete.
 */
export async function submitQuizAttemptAction(
  lessonId: string,
  answers: Record<string, number>,
): Promise<SubmitQuizResult> {
  try {
    const user = await requireActiveUser()
    const result = await memberCourseService.submitQuizAttempt(
      user.id,
      lessonId,
      answers,
    )

    if (result.passed) {
      // Only need a path revalidate when completion changed something.
      // The quiz UI itself stays mounted with local result state.
      revalidatePath('/courses')
      updateTag(PROGRESS_TAG)
    }

    return {
      ok: true,
      attemptId: result.attemptId,
      passed: result.passed,
      score: result.score,
      total: result.total,
      passingScore: result.passingScore,
      breakdown: result.breakdown,
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not submit quiz'
    return { ok: false, error: message }
  }
}

/**
 * Persist the user's current playback position so a refresh resumes
 * the video instead of restarting it. Fire-and-forget from the
 * client; never revalidates.
 */
export async function updateLessonPositionAction(
  lessonId: string,
  positionSec: number,
): Promise<{ ok: boolean }> {
  try {
    const user = await requireActiveUser()
    await memberCourseService.updateLessonPosition(
      user.id,
      lessonId,
      positionSec,
    )
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

/**
 * Generate a short-lived signed URL for a resource attachment.
 * Returned to the client so it can trigger the download directly.
 */
export async function getResourceDownloadUrlAction(
  resourceId: string,
): Promise<DownloadUrlResult> {
  try {
    const user = await requireActiveUser()
    const { url, filename } = await memberCourseService.getResourceDownloadUrl(
      user.id,
      resourceId,
    )
    return { ok: true, url, filename }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not get download link'
    return { ok: false, error: message }
  }
}

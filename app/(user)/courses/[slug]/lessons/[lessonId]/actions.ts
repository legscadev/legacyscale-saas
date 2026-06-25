'use server'

import { revalidatePath } from 'next/cache'

import { requireActiveUser } from '@/lib/auth'
import { memberCourseService } from '@/lib/services/member-course-service'

interface SetCompleteResult {
  ok: boolean
  progressPercent?: number
  completedCount?: number
  lessonsTotal?: number
  /** True when this call was the one that flipped progress to 100%
   *  for the first time (i.e. it stamped Enrollment.completedAt).
   *  Lets the caller route into the celebration screen. */
  justCompleted?: boolean
  /** Slug of the course this lesson belongs to — handy so the client
   *  can push to /courses/<slug>/complete without a second lookup. */
  courseSlug?: string
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
  /** True when passing this quiz flipped the course to 100%. Quiz
   *  runner uses this to route into the celebration screen. */
  justCompleted?: boolean
  courseSlug?: string
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

    // The course slug isn't on `result`, so invalidate the
     // dynamic-route shapes instead — covers any slug for this course.
    revalidatePath('/courses/[slug]/lessons/[lessonId]', 'page')
    revalidatePath('/courses/[slug]', 'page')
    revalidatePath('/courses')

    return {
      ok: true,
      progressPercent: result.progressPercent,
      completedCount: result.completedCount,
      lessonsTotal: result.lessonsTotal,
      justCompleted: result.justCompleted,
      courseSlug: result.courseSlug,
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
    }

    return {
      ok: true,
      attemptId: result.attemptId,
      passed: result.passed,
      score: result.score,
      total: result.total,
      passingScore: result.passingScore,
      breakdown: result.breakdown,
      justCompleted: result.justCompleted,
      courseSlug: result.courseSlug,
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

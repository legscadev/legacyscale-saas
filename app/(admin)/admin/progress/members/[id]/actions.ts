'use server'

import { requireAdmin } from '@/lib/auth/get-user'
import {
  adminProgressService,
  type MemberCourseProgress,
} from '@/lib/services/admin-progress-service'

/**
 * Lazy-load the chapter+lesson breakdown for one (member, course) pair.
 * Called when the operator expands a row on the member detail page.
 * Returning null means the course was deleted between page render and
 * the expand click — the UI should fall back to a "no data" state.
 */
export async function getMemberCourseProgressAction(
  userId: string,
  courseId: string,
): Promise<MemberCourseProgress | null> {
  await requireAdmin()
  return adminProgressService.getMemberCourseProgress(userId, courseId)
}

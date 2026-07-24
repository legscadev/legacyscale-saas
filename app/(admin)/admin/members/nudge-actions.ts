'use server'

import { requireAdmin } from '@/lib/auth/get-user'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/services/audit-log-service'
import { createNudge } from '@/lib/services/nudge-service'

export interface NudgeCoursePickerOption {
  id: string
  title: string
}

/** Enrolled courses for a specific member — used as the target-course
 *  dropdown in the nudge dialog. Empty list means the admin can still
 *  send a generic nudge (dashboard CTA). */
export async function listEnrolledCoursesForNudge(
  memberId: string,
): Promise<NudgeCoursePickerOption[]> {
  await requireAdmin()
  const rows = await prisma.enrollment.findMany({
    where: {
      userId: memberId,
      status: { in: ['ACTIVE'] },
      course: { deletedAt: null, status: 'PUBLISHED' },
    },
    orderBy: { lastAccessedAt: 'desc' },
    select: {
      course: { select: { id: true, title: true } },
    },
    take: 50,
  })
  return rows.map((r) => ({ id: r.course.id, title: r.course.title }))
}

export async function sendNudgeAction(
  memberId: string,
  courseId: string | null,
  message: string,
): Promise<
  | { ok: true; emailed: boolean }
  | { ok: false; error: string }
> {
  const admin = await requireAdmin()
  const result = await createNudge(admin.id, {
    userId: memberId,
    courseId,
    message,
  })
  if (!result.ok) return result
  await writeAuditLog({
    actorId: admin.id,
    action: 'nudge.send',
    resourceType: 'user',
    resourceId: memberId,
    summary: `Sent nudge to member ${memberId}${courseId ? ` (course ${courseId})` : ''}`,
    metadata: { courseId, message },
  })
  return { ok: true, emailed: result.emailed }
}

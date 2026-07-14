// Nudge = admin-authored re-engagement message. Delivered as a
// Resend email at create time AND surfaced as a dismissible banner
// on the member's next dashboard visit. Delivery + dismissal are
// tracked independently: email might fail while the banner still
// shows (or vice versa) so we don't lose the nudge either way.

import { NudgeEmail } from '@/emails'
import { getBranding } from '@/lib/branding/get-branding'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/resend'

const MESSAGE_MAX_LEN = 1000

export interface CreateNudgeInput {
  userId: string
  /** Optional target course. Deep-links the email + banner CTAs. */
  courseId?: string | null
  message: string
}

export interface ActiveNudge {
  id: string
  message: string
  createdAt: Date
  course: { id: string; title: string; slug: string } | null
}

/**
 * Admin creates a nudge, then we fire the email best-effort. The DB
 * row is written first so the banner shows even if Resend hiccups —
 * the whole point is to nudge, and we'd rather over-nudge than lose
 * the touchpoint.
 */
export async function createNudge(
  adminId: string,
  input: CreateNudgeInput,
): Promise<
  | { ok: true; nudgeId: string; emailed: boolean }
  | { ok: false; error: string }
> {
  const message = input.message?.trim() ?? ''
  if (!message) return { ok: false, error: 'Message is required' }
  if (message.length > MESSAGE_MAX_LEN) {
    return { ok: false, error: `Message must be ${MESSAGE_MAX_LEN} characters or fewer` }
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, name: true, isActive: true },
  })
  if (!user) return { ok: false, error: 'Member not found' }
  if (!user.isActive) return { ok: false, error: 'Member is inactive' }

  const course = input.courseId
    ? await prisma.course.findFirst({
        where: { id: input.courseId, deletedAt: null },
        select: { id: true, title: true, slug: true },
      })
    : null
  if (input.courseId && !course) {
    return { ok: false, error: 'Target course not found' }
  }

  const nudge = await prisma.nudge.create({
    data: {
      userId: user.id,
      courseId: course?.id ?? null,
      message,
      createdById: adminId,
    },
    select: { id: true },
  })

  const emailed = await sendNudgeEmail({
    to: user.email,
    memberName: user.name?.trim() || user.email.split('@')[0] || 'there',
    message,
    course,
  })
  if (emailed) {
    await prisma.nudge.update({
      where: { id: nudge.id },
      data: { emailSentAt: new Date() },
    })
  }

  return { ok: true, nudgeId: nudge.id, emailed }
}

/**
 * Powers the layout banner. Returns undismissed nudges in the order
 * they were created (newest first). Practically Ruby sends one at a
 * time so this is usually 0 or 1 rows.
 */
export async function listActiveNudgesForUser(
  userId: string,
): Promise<ActiveNudge[]> {
  const rows = await prisma.nudge.findMany({
    where: { userId, dismissedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      message: true,
      createdAt: true,
      course: { select: { id: true, title: true, slug: true } },
    },
  })
  return rows
}

/**
 * Member clicks Dismiss. Sets dismissedAt so the banner disappears.
 * Idempotent: dismissing an already-dismissed nudge is a no-op. Only
 * the recipient can dismiss.
 */
export async function dismissNudge(
  userId: string,
  nudgeId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const nudge = await prisma.nudge.findFirst({
    where: { id: nudgeId, userId },
    select: { id: true, dismissedAt: true },
  })
  if (!nudge) return { ok: false, error: 'Nudge not found' }
  if (nudge.dismissedAt) return { ok: true }

  await prisma.nudge.update({
    where: { id: nudgeId },
    data: { dismissedAt: new Date() },
  })
  return { ok: true }
}

// ============================================================
// INTERNALS
// ============================================================

interface SendNudgeEmailInput {
  to: string
  memberName: string
  message: string
  course: { id: string; title: string; slug: string } | null
}

async function sendNudgeEmail(input: SendNudgeEmailInput): Promise<boolean> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const ctaUrl = input.course
    ? `${base}/courses/${input.course.slug}`
    : `${base}/dashboard`
  const branding = await getBranding()

  try {
    await sendEmail({
      to: input.to,
      subject: input.course
        ? `A nudge from ${branding.productName} — ${input.course.title}`
        : `A nudge from ${branding.productName}`,
      purpose: 'notifications',
      fromName: branding.fromName,
      react: NudgeEmail({
        name: input.memberName,
        message: input.message,
        courseTitle: input.course?.title ?? null,
        ctaUrl,
        branding,
      }),
    })
    return true
  } catch (err) {
    console.error('Nudge email failed:', err)
    return false
  }
}

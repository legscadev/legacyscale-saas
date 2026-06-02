import { type NextRequest } from 'next/server'

import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  serverErrorResponse,
  successResponse,
  validateBody,
} from '@/lib/api/helpers'
import { completeOnboardingSchema } from '@/lib/validations/onboarding'

export async function POST(request: NextRequest) {
  const validation = await validateBody(request, completeOnboardingSchema)
  if (validation.error) return validation.error

  const { token, password } = validation.data

  // Atomically claim the invite. updateMany with a WHERE that guards
  // against double-redemption gives us a compare-and-set: if another
  // request beat us to it, count will be 0 and we bail with 410 — no
  // races, no need for an explicit transaction.
  const claim = await prisma.invite.updateMany({
    where: {
      token,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { usedAt: new Date() },
  })

  if (claim.count === 0) {
    return errorResponse('This invite link is invalid or has expired', 410)
  }

  // We own this invite now — fetch it and the user it points to.
  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!invite || !invite.user.authId) {
    console.error(
      'Claimed invite is missing user/authId — releasing',
      invite?.id,
    )
    await releaseInvite(token)
    return serverErrorResponse()
  }

  const admin = createAdminClient()

  // 1. Set the password. If this fails, release the claim so the
  //    member can retry from the same link.
  const { error: updateErr } = await admin.auth.admin.updateUserById(
    invite.user.authId,
    { password },
  )
  if (updateErr) {
    console.error('Password update failed:', updateErr.message)
    await releaseInvite(token)
    return serverErrorResponse()
  }

  // 2. Establish a session in this request using the cookie-aware
  //    client. Failure here is non-fatal — the password is set; the
  //    user can sign in manually.
  const supabase = await createClient()
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: invite.user.email,
    password,
  })
  if (signInErr) {
    console.error('Auto-sign-in after onboarding failed:', signInErr.message)
  }

  // 3. Bump lastLoginAt so the dashboard greets them as just-signed-in.
  await prisma.user.update({
    where: { id: invite.userId },
    data: { lastLoginAt: new Date() },
  })

  return successResponse({
    redirectTo:
      invite.user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard',
  })
}

/**
 * Undo a previously-claimed invite. Called when a post-claim step
 * (password update) fails so the member can click the link again
 * and try once more.
 */
async function releaseInvite(token: string): Promise<void> {
  try {
    await prisma.invite.update({
      where: { token },
      data: { usedAt: null },
    })
  } catch (err) {
    console.error('Failed to release invite after error:', err)
  }
}

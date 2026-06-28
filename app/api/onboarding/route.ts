import { type NextRequest } from 'next/server'

import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit'
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
  // 10 onboarding password-set attempts per 15 minutes per IP —
  // bounds token-guessing on the invite link.
  const rl = await checkRateLimit({
    action: 'auth:onboarding',
    windowSec: 900,
    max: 10,
  })
  if (!rl.ok) {
    return errorResponse(
      `Too many attempts. Try again in ${Math.ceil(rl.retryAfter / 60)} minutes.`,
      429,
    )
  }

  const validation = await validateBody(request, completeOnboardingSchema)
  if (validation.error) return validation.error

  const { token, password } = validation.data

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { user: true },
  })

  if (
    !invite ||
    invite.usedAt ||
    invite.expiresAt <= new Date() ||
    !invite.user.authId
  ) {
    return errorResponse('This invite link is invalid or has expired', 410)
  }

  // Re-entry after a previous successful password set (e.g. wizard
  // reload). Only the originally-onboarding user is allowed to re-set
  // the password — anyone else with the link is locked out.
  if (invite.passwordSetAt) {
    const supabase = await createClient()
    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser()
    if (!sessionUser || sessionUser.id !== invite.user.authId) {
      return errorResponse('This invite link is invalid or has expired', 410)
    }
  } else {
    // First-time claim. Compare-and-set on passwordSetAt prevents two
    // racing clicks from both setting (potentially different) passwords.
    const claim = await prisma.invite.updateMany({
      where: { token, passwordSetAt: null },
      data: { passwordSetAt: new Date() },
    })
    if (claim.count === 0) {
      return errorResponse('This invite link is invalid or has expired', 410)
    }
  }

  const admin = createAdminClient()
  const { error: updateErr } = await admin.auth.admin.updateUserById(
    invite.user.authId,
    { password },
  )
  if (updateErr) {
    console.error('Password update failed:', updateErr.message)
    return serverErrorResponse()
  }

  // Establish a session in this request via the cookie-aware client.
  // Non-fatal if it fails — the password is set; manual sign-in works.
  const supabase = await createClient()
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: invite.user.email,
    password,
  })
  if (signInErr) {
    console.error('Auto-sign-in after onboarding failed:', signInErr.message)
  }

  await prisma.user.update({
    where: { id: invite.userId },
    data: { lastLoginAt: new Date() },
  })

  return successResponse({
    redirectTo:
      invite.user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard',
  })
}

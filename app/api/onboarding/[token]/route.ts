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

interface RouteContext {
  params: Promise<{ token: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { token } = await context.params

  const validation = await validateBody(request, completeOnboardingSchema)
  if (validation.error) return validation.error

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return errorResponse(
      'This invite link is invalid or has expired',
      410,
    )
  }

  if (!invite.user.authId) {
    // Sanity check — shouldn't happen since admin create flow sets authId.
    console.error('Invite user has no authId:', invite.userId)
    return serverErrorResponse()
  }

  const admin = createAdminClient()

  // 1. Set the new password through Supabase Auth admin.
  const { error: updateErr } = await admin.auth.admin.updateUserById(
    invite.user.authId,
    { password: validation.data.password },
  )
  if (updateErr) {
    console.error('Password update failed:', updateErr.message)
    return serverErrorResponse()
  }

  // 2. Sign the user in by establishing a session in this request. We
  //    use the public client (cookie-aware) with the just-set password
  //    so the session cookie persists on the response.
  const supabase = await createClient()
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: invite.user.email,
    password: validation.data.password,
  })
  if (signInErr) {
    console.error('Auto-sign-in after onboarding failed:', signInErr.message)
    // Mark used anyway — the password was set; they can log in manually.
  }

  // 3. Mark the invite consumed.
  await prisma.invite.update({
    where: { id: invite.id },
    data: { usedAt: new Date() },
  })

  // 4. Update lastLoginAt so the welcome state on the dashboard is fresh.
  await prisma.user.update({
    where: { id: invite.userId },
    data: { lastLoginAt: new Date() },
  })

  return successResponse({
    redirectTo: invite.user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard',
  })
}

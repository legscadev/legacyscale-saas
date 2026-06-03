import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  successResponse,
  validateBody,
} from '@/lib/api/helpers'

const completeSchema = z.object({
  token: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const validation = await validateBody(request, completeSchema)
  if (validation.error) return validation.error

  const { token } = validation.data

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { user: { select: { authId: true } } },
  })

  if (!invite || invite.expiresAt <= new Date()) {
    return errorResponse('This invite link is invalid or has expired', 410)
  }

  // Already consumed — idempotent success so a double-click on Finish
  // doesn't surface an error.
  if (invite.usedAt) {
    return successResponse({ alreadyComplete: true })
  }

  // Only the user the invite was issued for can complete it. The
  // password step bumps the session, so by the time we get here the
  // user should be signed in as that account.
  const supabase = await createClient()
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser()
  if (!sessionUser || sessionUser.id !== invite.user.authId) {
    return errorResponse('Not authenticated for this invite', 403)
  }

  await prisma.invite.update({
    where: { token },
    data: { usedAt: new Date() },
  })

  return successResponse({ alreadyComplete: false })
}

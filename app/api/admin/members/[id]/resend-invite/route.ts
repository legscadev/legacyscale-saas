import { type NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

import { requireAdmin } from '@/lib/auth/get-user'
import { issueInvite } from '@/lib/invites'
import { prisma } from '@/lib/prisma'
import { sendWelcomeEmail } from '@/lib/resend'
import {
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  successResponse,
} from '@/lib/api/helpers'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  const { id } = await context.params

  if (id === admin.id) {
    // Self-invite makes no sense — admin is signed in already.
    return errorResponse("You can't invite yourself", 400)
  }

  try {
    const member = await prisma.user.findUniqueOrThrow({
      where: { id, deletedAt: null },
      select: { id: true, email: true, name: true },
    })

    // Issue a fresh token. issueInvite invalidates any prior unused
    // invite for the same user so old links stop working.
    const token = await issueInvite(member.id)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const onboardingUrl = `${appUrl}/onboarding?token=${token}`

    try {
      await sendWelcomeEmail(
        member.email,
        member.name ?? member.email.split('@')[0]!,
        {
          ctaUrl: onboardingUrl,
          variant: 'invite',
        },
      )
    } catch (err) {
      console.error('Resend invite email failed:', err)
      return errorResponse(
        'Invite created but email failed to send',
        502,
      )
    }

    return successResponse({ email: member.email })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      return notFoundResponse('Member')
    }
    console.error('Resend invite failed:', err)
    return serverErrorResponse()
  }
}

import { type NextRequest } from 'next/server'

import { requireAdmin } from '@/lib/auth/get-user'
import { syncUserToDatabase } from '@/lib/auth/sync-user'
import { issueInvite } from '@/lib/invites'
import { prisma } from '@/lib/prisma'
import { sendWelcomeEmail } from '@/lib/resend'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  errorResponse,
  serverErrorResponse,
  successResponse,
  validateBody,
} from '@/lib/api/helpers'
import { adminCreateMemberSchema } from '@/lib/validations/admin-members'

function emailConflictResponse() {
  return errorResponse('A member with this email already exists', 409, {
    email: ['A member with this email already exists'],
  })
}

/**
 * Generates a strong random password the admin never sees. The new
 * member sets their own password through the onboarding flow before
 * this one ever gets used.
 */
function generateInternalPassword(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString('base64')
}

export async function POST(request: NextRequest) {
  await requireAdmin()

  const validation = await validateBody(request, adminCreateMemberSchema)
  if (validation.error) return validation.error

  const { name, email, role, categoryId } = validation.data
  const normalizedEmail = email.toLowerCase().trim()
  // ADMIN/TEAM bypass the category gate entirely, so a category on
  // those roles would just be noise. Only persist it for MEMBER.
  const effectiveCategoryId = role === 'MEMBER' ? (categoryId ?? null) : null

  // Pre-check the DB (source of truth) so the duplicate-email error
  // carries a field-level detail without depending on Supabase string
  // matching.
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  })
  if (existing) return emailConflictResponse()

  const admin = createAdminClient()

  // 1. Create the Supabase Auth user with a throwaway password the
  //    member never knows. email_confirm: true skips the address-
  //    confirmation email.
  const { data: created, error: createErr } = await admin.auth.admin.createUser(
    {
      email: normalizedEmail,
      password: generateInternalPassword(),
      email_confirm: true,
      user_metadata: { name },
    },
  )

  if (createErr || !created.user) {
    const message = createErr?.message ?? 'Failed to create user'
    if (/already (been )?registered|exists/i.test(message)) {
      return emailConflictResponse()
    }
    console.error('admin.createUser failed:', message)
    return serverErrorResponse()
  }

  try {
    // 2. Sync into our users table — suppress the auto-welcome since
    //    we're sending an invite-variant email below.
    const user = await syncUserToDatabase(created.user, {
      suppressWelcomeEmail: true,
    })

    // Honor the role the admin picked (sync defaults new rows to MEMBER).
    if (user.role !== role || user.categoryId !== effectiveCategoryId) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(user.role !== role ? { role } : {}),
          ...(user.categoryId !== effectiveCategoryId
            ? { categoryId: effectiveCategoryId }
            : {}),
        },
      })
      if (user.role !== role) {
        await admin.auth.admin.updateUserById(created.user.id, {
          app_metadata: { role },
        })
      }
    }

    // 3. Issue the onboarding invite token (also invalidates any
    //    prior unused invites for safety, though there shouldn't be
    //    any for a fresh user).
    const token = await issueInvite(user.id)

    // 4. Send the invite-variant welcome email.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const onboardingUrl = `${appUrl}/onboarding?token=${token}`
    try {
      await sendWelcomeEmail(user.email, name, {
        ctaUrl: onboardingUrl,
        variant: 'invite',
      })
    } catch (err) {
      // Don't fail the create on email — the admin can resend later.
      console.error('Onboarding email send failed:', err)
    }

    return successResponse(
      {
        member: {
          id: user.id,
          email: user.email,
          name: user.name,
          role,
        },
      },
      201,
    )
  } catch (err) {
    console.error('Post-create sync failed:', err)
    return serverErrorResponse()
  }
}

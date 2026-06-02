import { type NextRequest } from 'next/server'

import { requireAdmin } from '@/lib/auth/get-user'
import { syncUserToDatabase } from '@/lib/auth/sync-user'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  errorResponse,
  serverErrorResponse,
  successResponse,
  validateBody,
} from '@/lib/api/helpers'
import { adminCreateMemberSchema } from '@/lib/validations/admin-members'

function emailConflictResponse() {
  return errorResponse(
    'A member with this email already exists',
    409,
    { email: ['A member with this email already exists'] },
  )
}

/**
 * Generates a 16-char URL-safe random temporary password.
 *
 * The admin sees this once in the success view and is expected to
 * share it with the new member out-of-band. After the new member's
 * first login they can change it from their profile.
 */
function generateTempPassword(): string {
  // 12 random bytes → 16 chars in base64url, safely above Supabase's
  // 6-char minimum and our app's 8-char rule.
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function POST(request: NextRequest) {
  await requireAdmin()

  const validation = await validateBody(request, adminCreateMemberSchema)
  if (validation.error) return validation.error

  const { name, email, role } = validation.data
  const normalizedEmail = email.toLowerCase().trim()
  const temporaryPassword = generateTempPassword()

  // Pre-check: bail early on duplicate (including soft-deleted rows —
  // an archived user with the same email still owns it). We rely on
  // the DB-level @unique constraint as the source of truth, but this
  // gives us a clean field-level error before touching Supabase Auth.
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  })
  if (existing) return emailConflictResponse()

  const admin = createAdminClient()

  // 1. Create the Supabase Auth user. email_confirm: true skips the
  //    address-confirmation email; the welcome email handles onboarding.
  const { data: created, error: createErr } = await admin.auth.admin.createUser(
    {
      email: normalizedEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { name },
    },
  )

  if (createErr || !created.user) {
    // Supabase returns a duplicate-email error when the email already
    // belongs to an auth user.
    const message = createErr?.message ?? 'Failed to create user'
    // Catches the race where the Prisma pre-check passes but a parallel
    // request (or an orphaned auth user not yet synced) collides here.
    if (/already (been )?registered|exists/i.test(message)) {
      return emailConflictResponse()
    }
    console.error('admin.createUser failed:', message)
    return serverErrorResponse()
  }

  // 2. Sync into our users table + send welcome email. Role is set
  //    after sync so the requested role wins over the MEMBER default.
  try {
    const user = await syncUserToDatabase(created.user)

    if (user.role !== role) {
      // syncUserToDatabase preserves the existing role on update,
      // but for a brand-new row the default is MEMBER. If the admin
      // picked ADMIN, promote them here.
      await prisma.user.update({
        where: { id: user.id },
        data: { role },
      })

      // Mirror the role into Supabase Auth so /login bounce reflects
      // it before the user signs in for the first time.
      await admin.auth.admin.updateUserById(created.user.id, {
        app_metadata: { role },
      })
    }

    return successResponse(
      {
        member: {
          id: user.id,
          email: user.email,
          name: user.name,
          role,
        },
        temporaryPassword,
      },
      201,
    )
  } catch (err) {
    console.error('Post-create sync failed:', err)
    return serverErrorResponse()
  }
}

import type { CompanyRole, Role } from '@prisma/client'

import { syncUserToDatabase } from '@/lib/auth/sync-user'
import { issueInvite } from '@/lib/invites'
import { prisma } from '@/lib/prisma'
import { sendWelcomeEmail } from '@/lib/resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRequestCompanyId } from '@/lib/tenancy/request-company'

export interface ProvisionMemberInput {
  name: string
  email: string
  role: Role
  /**
   * Optional category tier. Only meaningful for the MEMBER role; the
   * caller (or this helper) normalises it to null for ADMIN/TEAM.
   */
  categoryId?: string | null
}

export interface ProvisionedMember {
  id: string
  email: string
  name: string | null
  role: Role
}

/**
 * Thrown when the target email already exists in the users table.
 * Callers can catch to convert to a 409 with a field-level detail
 * instead of a generic 500.
 */
export class MemberEmailConflictError extends Error {
  constructor(message = 'A member with this email already exists') {
    super(message)
    this.name = 'MemberEmailConflictError'
  }
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

/** Maps the legacy per-user Role enum onto the new CompanyRole
 *  enum. ADMIN → OWNER retains the same "runs the tenant"
 *  semantics; MEMBER + TEAM map straight across. */
function mapRoleToCompanyRole(role: Role): CompanyRole {
  switch (role) {
    case 'ADMIN':
      return 'OWNER'
    case 'TEAM':
      return 'TEAM'
    default:
      return 'MEMBER'
  }
}

/**
 * Creates a Supabase auth user, mirrors them into our `users` table,
 * pins the requested role/category, issues an onboarding invite
 * token, and fires the invite email. Returns the persisted User.
 *
 * The email-send failure is intentionally swallowed with a
 * `console.error` — the admin can always resend from the members
 * page. Everything else throws.
 */
export async function provisionMemberWithInvite(
  input: ProvisionMemberInput,
): Promise<ProvisionedMember> {
  const normalizedEmail = input.email.toLowerCase().trim()
  const effectiveCategoryId =
    input.role === 'MEMBER' ? (input.categoryId ?? null) : null

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  })
  if (existing) throw new MemberEmailConflictError()

  const admin = createAdminClient()

  const { data: created, error: createErr } =
    await admin.auth.admin.createUser({
      email: normalizedEmail,
      password: generateInternalPassword(),
      email_confirm: true,
      user_metadata: { name: input.name },
    })

  if (createErr || !created.user) {
    const message = createErr?.message ?? 'Failed to create user'
    if (/already (been )?registered|exists/i.test(message)) {
      throw new MemberEmailConflictError()
    }
    throw new Error(`Failed to create Supabase auth user: ${message}`)
  }

  const user = await syncUserToDatabase(created.user, {
    suppressWelcomeEmail: true,
  })

  if (user.role !== input.role || user.categoryId !== effectiveCategoryId) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(user.role !== input.role ? { role: input.role } : {}),
        ...(user.categoryId !== effectiveCategoryId
          ? { categoryId: effectiveCategoryId }
          : {}),
      },
    })
    if (user.role !== input.role) {
      await admin.auth.admin.updateUserById(created.user.id, {
        app_metadata: { role: input.role },
      })
    }
  }

  // When tenancy is enabled, provisioning through a company admin's
  // request context also creates the company membership so the new
  // user shows up in that tenant's member list. No-op when the flag
  // is off — memberships are Phase-2-only.
  const activeCompanyId = await getRequestCompanyId()
  if (activeCompanyId) {
    const companyRole = mapRoleToCompanyRole(input.role)
    await prisma.companyMembership.upsert({
      where: {
        userId_companyId: { userId: user.id, companyId: activeCompanyId },
      },
      update: { role: companyRole },
      create: {
        userId: user.id,
        companyId: activeCompanyId,
        role: companyRole,
      },
    })
  }

  const token = await issueInvite(user.id)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const onboardingUrl = `${appUrl}/onboarding?token=${token}`
  try {
    await sendWelcomeEmail(user.email, input.name, {
      ctaUrl: onboardingUrl,
      variant: 'invite',
    })
  } catch (err) {
    console.error('Onboarding email send failed:', err)
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: input.role,
  }
}

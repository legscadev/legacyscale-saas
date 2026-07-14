// Super-admin flow: stand up a new tenant (Company) with an initial
// OWNER user. Runs inside runAsSuperAdmin so the Prisma tenancy
// extension steps out of the way while we cross tenants.

import type { Company, User } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { syncRoleToAuthMetadata, syncUserToDatabase } from '@/lib/auth/sync-user'
import { issueInvite } from '@/lib/invites'
import { sendCompanyOwnerInvite, sendOwnerAddedNotice } from '@/lib/resend'
import { runAsSuperAdmin } from '@/lib/tenancy/request-company'
import { createAdminClient } from '@/lib/supabase/admin'

export class CompanySlugConflictError extends Error {
  constructor(message = 'A company with this slug already exists') {
    super(message)
    this.name = 'CompanySlugConflictError'
  }
}

export class DeletedOwnerError extends Error {
  constructor(
    message = 'The owner email belongs to a soft-deleted user. Restore the account first, or use a different email.',
  ) {
    super(message)
    this.name = 'DeletedOwnerError'
  }
}

export interface CreateCompanyInput {
  name: string
  slug: string
  isAgency?: boolean
  owner: {
    email: string
    name?: string
  }
  /**
   * When true (default), send a "you've been added as owner of X"
   * heads-up email to EXISTING users who get attached to the new
   * tenant. Set false for self-assign flows where the caller IS the
   * new owner and already knows. Never gates the fresh-account
   * invite — those users need the password-set link no matter what.
   */
  notifyExistingOwner?: boolean
}

export interface CreatedCompany {
  company: Company
  owner: User
  ownerWasNewlyCreated: boolean
}

function generateInternalPassword(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString('base64')
}

function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Creates a Company row + guarantees an OWNER membership on it.
 * Reuses an existing users row when the email is already known;
 * otherwise mints a fresh Supabase auth user + local users row
 * following the same pattern as provisionMemberWithInvite.
 *
 * Slug conflicts throw CompanySlugConflictError so the caller can
 * surface a field-level error instead of a generic 500.
 */
export async function createCompany(
  input: CreateCompanyInput,
): Promise<CreatedCompany> {
  const normalizedSlug = normalizeSlug(input.slug)
  if (normalizedSlug.length === 0) {
    throw new Error('Slug is required')
  }
  const normalizedEmail = input.owner.email.toLowerCase().trim()

  return runAsSuperAdmin(async () => {
    const existingCompany = await prisma.company.findFirst({
      where: { slug: normalizedSlug, deletedAt: null },
      select: { id: true },
    })
    if (existingCompany) throw new CompanySlugConflictError()

    let owner = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })
    let ownerWasNewlyCreated = false
    let existingUserWasPromoted = false

    // Reject soft-deleted matches so we don't attach OWNER to a dead
    // account (the row would look orphaned — nobody can sign in as
    // them, but the "Owner" column reads the deleted name). Caller
    // surfaces the message so the operator can pick a different
    // email or restore the account.
    if (owner?.deletedAt) {
      throw new DeletedOwnerError()
    }

    if (!owner) {
      const admin = createAdminClient()
      const displayName = input.owner.name?.trim() || normalizedEmail
      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email: normalizedEmail,
          password: generateInternalPassword(),
          email_confirm: true,
          user_metadata: { name: displayName },
        })
      if (createErr || !created.user) {
        throw new Error(
          `Failed to create Supabase auth user: ${createErr?.message ?? 'unknown'}`,
        )
      }
      owner = await syncUserToDatabase(created.user, {
        suppressWelcomeEmail: true,
      })
      // A fresh tenant OWNER runs their own admin console, so their
      // global User.role must be ADMIN — the CompanyMembership OWNER
      // role alone isn't enough (requireAdmin gates on the global
      // column).
      owner = await prisma.user.update({
        where: { id: owner.id },
        data: { role: 'ADMIN' },
      })
      await syncRoleToAuthMetadata(created.user.id, 'ADMIN')
      ownerWasNewlyCreated = true
    } else if (owner.role !== 'ADMIN' && !owner.isSuperAdmin) {
      // Existing user made OWNER of a tenant needs ADMIN globally too,
      // otherwise requireAdmin bounces them from /admin/*. The old
      // behavior silently attached OWNER while leaving them at
      // role=MEMBER, which is the "Playwright Test pt548361 owner
      // can't reach their own admin console" bug. Super-admins are
      // exempt because their gate bypasses role checks anyway.
      owner = await prisma.user.update({
        where: { id: owner.id },
        data: { role: 'ADMIN' },
      })
      if (owner.authId) {
        await syncRoleToAuthMetadata(owner.authId, 'ADMIN')
      }
      existingUserWasPromoted = true
    }

    const company = await prisma.company.create({
      data: {
        name: input.name.trim(),
        slug: normalizedSlug,
        isAgency: input.isAgency ?? false,
      },
    })

    await prisma.companyMembership.upsert({
      where: {
        userId_companyId: { userId: owner.id, companyId: company.id },
      },
      update: { role: 'OWNER' },
      create: {
        userId: owner.id,
        companyId: company.id,
        role: 'OWNER',
      },
    })

    // Fresh accounts get an onboarding invite so the OWNER can
    // actually sign in — mirrors provisionMemberWithInvite. Without
    // this the account exists in Supabase auth with a password
    // nobody knows, and the recipient has no way in. Email failure
    // is logged but non-fatal: the company + membership are the
    // load-bearing parts, and the operator can re-fire the invite
    // manually if needed.
    if (ownerWasNewlyCreated) {
      // Scope the invite to the new tenant so the onboarding surface
      // can name the company the owner is being handed.
      const token = await issueInvite(owner.id, { companyId: company.id })
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      const onboardingUrl = `${appUrl}/onboarding?token=${token}`
      const displayName = input.owner.name?.trim() || normalizedEmail
      try {
        await sendCompanyOwnerInvite(normalizedEmail, displayName, {
          companyName: company.name,
          ctaUrl: onboardingUrl,
        })
      } catch (err) {
        console.error('Company-owner invite email failed:', err)
      }
    } else if (input.notifyExistingOwner !== false) {
      // Heads-up to an existing user who just got OWNER of a new
      // tenant. Copy adapts to whether they're a super-admin (no
      // access change) or a regular user (promoted to admin, if that
      // happened). Self-assign flows skip this by passing
      // notifyExistingOwner: false — the caller obviously knows.
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      const dashboardUrl = `${appUrl}/admin/dashboard`
      const displayName = owner.name ?? normalizedEmail.split('@')[0]
      try {
        await sendOwnerAddedNotice(normalizedEmail, displayName, {
          companyName: company.name,
          ctaUrl: dashboardUrl,
          isSuperAdmin: owner.isSuperAdmin,
          wasPromoted: existingUserWasPromoted,
        })
      } catch (err) {
        console.error('Owner-added notice email failed:', err)
      }
    }

    return { company, owner, ownerWasNewlyCreated }
  })
}

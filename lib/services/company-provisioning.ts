// Super-admin flow: stand up a new tenant (Company) with an initial
// OWNER user. Runs inside runAsSuperAdmin so the Prisma tenancy
// extension steps out of the way while we cross tenants.

import type { Company, User } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { syncUserToDatabase } from '@/lib/auth/sync-user'
import { issueInvite } from '@/lib/invites'
import { sendWelcomeEmail } from '@/lib/resend'
import { runAsSuperAdmin } from '@/lib/tenancy/request-company'
import { createAdminClient } from '@/lib/supabase/admin'

export class CompanySlugConflictError extends Error {
  constructor(message = 'A company with this slug already exists') {
    super(message)
    this.name = 'CompanySlugConflictError'
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
      ownerWasNewlyCreated = true
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
      const token = await issueInvite(owner.id)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      const onboardingUrl = `${appUrl}/onboarding?token=${token}`
      const displayName = input.owner.name?.trim() || normalizedEmail
      try {
        await sendWelcomeEmail(normalizedEmail, displayName, {
          ctaUrl: onboardingUrl,
          variant: 'invite',
        })
      } catch (err) {
        console.error('Company-owner invite email failed:', err)
      }
    }

    return { company, owner, ownerWasNewlyCreated }
  })
}

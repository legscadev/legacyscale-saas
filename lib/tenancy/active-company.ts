// Active-company context for the current request.
//
// The signed-in user carries a persistent choice of which Company
// they're currently viewing. Stored in a cookie so it survives
// navigation + tabs; verified against CompanyMembership on every
// server call so a stolen or stale cookie can't reach data the user
// doesn't belong to.
//
// Super-admins (User.isSuperAdmin) can set the cookie to any
// company id — that's how Keanu "enters" a sub-account in Phase 3.
//
// Every entry point routes through isTenancyEnabled() so the flag
// can no-op the entire tenancy stack until Phase 7 rollout.

import { cookies } from 'next/headers'
import { cache } from 'react'
import type { Company, User } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth/get-user'
import { isTenancyEnabled } from './feature-flag'

/** Cookie name used to remember the active company across
 *  navigation. Not HttpOnly on purpose — the client-side switcher
 *  needs to read + write it. */
const ACTIVE_COMPANY_COOKIE = 'active_company_id'

/** How long the cookie lives before we ask again. Long by design;
 *  the switcher rewrites it whenever Ruby (or Keanu) picks a
 *  different tenant. */
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90 // 90 days

/**
 * Look up the caller's current company. Returns null when tenancy
 * is disabled, when there's no signed-in user, or when the cookie
 * doesn't point at a company the user is allowed into.
 *
 * Cached per-request via React's cache() so layouts + pages + server
 * actions share one DB round-trip.
 */
export const getActiveCompany = cache(async (): Promise<Company | null> => {
  if (!isTenancyEnabled()) return null

  const user = await getUser()
  if (!user) return null

  const cookieStore = await cookies()
  const requestedId = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value

  // Super-admins can jump to any tenant. Everyone else must have a
  // membership on the requested company. When the cookie is unset
  // or invalid, fall back to the user's first-created membership so
  // day-one users land somewhere sensible.
  const company = requestedId
    ? await resolveRequestedCompany(user, requestedId)
    : null
  if (company) return company

  return fallbackCompany(user)
})

/**
 * Set the active-company cookie on the current server response.
 * Callers (the switcher, the super-admin "Enter" button) verify
 * access themselves — this helper just persists the choice.
 */
export async function setActiveCompanyCookie(companyId: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  })
}

/** Convenience for the sign-out / leave-company flows. */
export async function clearActiveCompanyCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(ACTIVE_COMPANY_COOKIE)
}

/**
 * Every company the caller has access to. Used by the switcher UI
 * so the dropdown shows only real options. Super-admins see every
 * non-deleted company; regular users see their memberships.
 */
export async function listCompaniesForUser(user: User): Promise<Company[]> {
  if (user.isSuperAdmin) {
    return prisma.company.findMany({
      where: { deletedAt: null },
      orderBy: [{ isAgency: 'desc' }, { name: 'asc' }],
    })
  }
  const memberships = await prisma.companyMembership.findMany({
    where: {
      userId: user.id,
      company: { deletedAt: null },
    },
    orderBy: { createdAt: 'asc' },
    include: { company: true },
  })
  return memberships.map((m) => m.company)
}

// ────────────────────────────────────────────
// INTERNALS
// ────────────────────────────────────────────

async function resolveRequestedCompany(
  user: User,
  companyId: string,
): Promise<Company | null> {
  const company = await prisma.company.findFirst({
    where: { id: companyId, deletedAt: null },
  })
  if (!company) return null

  if (user.isSuperAdmin) return company

  const membership = await prisma.companyMembership.findUnique({
    where: {
      userId_companyId: { userId: user.id, companyId: company.id },
    },
    select: { id: true },
  })
  return membership ? company : null
}

async function fallbackCompany(user: User): Promise<Company | null> {
  if (user.isSuperAdmin) {
    return prisma.company.findFirst({
      where: { deletedAt: null },
      orderBy: [{ isAgency: 'desc' }, { name: 'asc' }],
    })
  }
  const membership = await prisma.companyMembership.findFirst({
    where: {
      userId: user.id,
      company: { deletedAt: null },
    },
    orderBy: { createdAt: 'asc' },
    include: { company: true },
  })
  return membership?.company ?? null
}

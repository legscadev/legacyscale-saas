'use server'

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/auth/get-user'
import {
  getPlatformApexDomain,
  managedSubdomainFor,
} from '@/lib/domains/platform'
import { prisma } from '@/lib/prisma'
import { getActiveCompany } from '@/lib/tenancy/active-company'

export interface DomainRow {
  id: string
  hostname: string
  kind: 'MANAGED_SUBDOMAIN' | 'CUSTOM'
  isPrimary: boolean
  verifiedAt: Date | null
  sslIssuedAt: Date | null
  createdAt: Date
}

export interface DomainSaveResult {
  ok: boolean
  error?: string
  domain?: DomainRow
}

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/

/** Rows for the current tenant, ordered newest first. */
export async function listDomainsAction(): Promise<DomainRow[]> {
  await requireAdmin()
  const company = await getActiveCompany()
  if (!company) return []
  const rows = await prisma.domain.findMany({
    where: { companyId: company.id },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      hostname: true,
      kind: true,
      isPrimary: true,
      verifiedAt: true,
      sslIssuedAt: true,
      createdAt: true,
    },
  })
  return rows
}

/**
 * Register a managed subdomain (`<slug>.<PLATFORM_APEX_DOMAIN>`).
 * The wildcard cert on the apex means no Vercel API call is needed
 * — this row lands verified immediately.
 *
 * Marks the new row primary if this is the tenant's first
 * MANAGED_SUBDOMAIN. Otherwise leaves primary alone.
 */
export async function claimManagedSubdomainAction(
  formData: FormData,
): Promise<DomainSaveResult> {
  await requireAdmin()
  const company = await getActiveCompany()
  if (!company) {
    return {
      ok: false,
      error:
        'No active company. Turn on TENANCY_ENABLED and select a tenant.',
    }
  }

  const slug = String(formData.get('slug') ?? '')
    .trim()
    .toLowerCase()
  if (!SLUG_PATTERN.test(slug)) {
    return {
      ok: false,
      error:
        'Slug must be 1–60 characters, lowercase letters, digits, and dashes (no leading/trailing dash).',
    }
  }

  const hostname = managedSubdomainFor(slug)

  try {
    const existingPrimary = await prisma.domain.findFirst({
      where: {
        companyId: company.id,
        kind: 'MANAGED_SUBDOMAIN',
        isPrimary: true,
      },
      select: { id: true },
    })

    const domain = await prisma.domain.upsert({
      where: { hostname },
      update: {
        // If somehow the row already existed for this tenant, refresh
        // its verifiedAt; this is a no-op in the common case.
        verifiedAt: new Date(),
        companyId: company.id,
      },
      create: {
        companyId: company.id,
        hostname,
        kind: 'MANAGED_SUBDOMAIN',
        isPrimary: existingPrimary === null,
        verifiedAt: new Date(),
      },
      select: {
        id: true,
        hostname: true,
        kind: true,
        isPrimary: true,
        verifiedAt: true,
        sslIssuedAt: true,
        createdAt: true,
      },
    })

    revalidatePath('/admin/settings')
    return { ok: true, domain }
  } catch (err) {
    // Unique-constraint violations mean the hostname is already
    // taken by another tenant. Anything else is a real bug.
    const code = (err as { code?: string }).code
    if (code === 'P2002') {
      return {
        ok: false,
        error: `Subdomain ${hostname} is already taken by another tenant.`,
      }
    }
    console.error('claimManagedSubdomainAction failed:', err)
    return { ok: false, error: 'Could not claim subdomain' }
  }
}

/** Detach a domain from the tenant. Removes DB row only; a future
 *  task also un-registers custom domains from Vercel. */
export async function removeDomainAction(
  domainId: string,
): Promise<DomainSaveResult> {
  await requireAdmin()
  const company = await getActiveCompany()
  if (!company) return { ok: false, error: 'No active company.' }

  try {
    const deleted = await prisma.domain.deleteMany({
      where: { id: domainId, companyId: company.id },
    })
    if (deleted.count === 0) {
      return { ok: false, error: 'Domain not found' }
    }
    revalidatePath('/admin/settings')
    return { ok: true }
  } catch (err) {
    console.error('removeDomainAction failed:', err)
    return { ok: false, error: 'Could not remove domain' }
  }
}

/** Returns the current apex domain so the client card can render
 *  the ".apex" preview next to the slug input. Server-only value
 *  passed as a plain string. */
export async function getPlatformApexAction(): Promise<string> {
  await requireAdmin()
  return getPlatformApexDomain()
}

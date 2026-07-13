'use server'

import { randomBytes } from 'node:crypto'
import { promises as dns } from 'node:dns'

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/auth/get-user'
import {
  getPlatformApexDomain,
  managedSubdomainFor,
} from '@/lib/domains/platform'
import {
  addDomainToProject,
  getDomainStatus,
  isVercelConfigured,
  removeDomainFromProject,
} from '@/lib/domains/vercel-client'
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
  /** Only surfaced for un-verified custom domains — the value the
   *  tenant needs to publish as a TXT record. Managed rows return null. */
  verificationToken?: string | null
}

/** DNS-safe hostname: lowercase, letters/digits/dots/hyphens; label
 *  rules relaxed since we care about "is this a real hostname" not
 *  RFC compliance. Rejects obvious garbage; browsers reject the rest. */
const HOSTNAME_PATTERN = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/

function newVerificationToken(): string {
  return `kondense-verify-${randomBytes(16).toString('hex')}`
}

/** Looks up TXT records at `_kondense-verify.<hostname>`. Returns
 *  every value found (each record can be an array of string chunks
 *  which we join before comparing). Returns [] on lookup failure. */
async function lookupVerificationTxt(hostname: string): Promise<string[]> {
  try {
    const records = await dns.resolveTxt(`_kondense-verify.${hostname}`)
    return records.map((chunks) => chunks.join(''))
  } catch {
    return []
  }
}

export interface DomainSaveResult {
  ok: boolean
  error?: string
  domain?: DomainRow
}

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/

/** Rows for the current tenant, ordered newest first. Includes the
 *  verificationToken only for un-verified custom domains so the UI
 *  can show DNS instructions. */
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
      verificationToken: true,
      createdAt: true,
    },
  })
  return rows.map((r) => ({
    ...r,
    verificationToken:
      r.kind === 'CUSTOM' && r.verifiedAt === null
        ? r.verificationToken
        : null,
  }))
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

/**
 * Register a custom domain (`portal.acme.com`-style). The row lands
 * un-verified with a fresh TXT-verification token. The tenant is
 * expected to publish the token as a TXT record at
 * `_kondense-verify.<hostname>`, then click Verify.
 */
export async function startCustomDomainAction(
  formData: FormData,
): Promise<DomainSaveResult> {
  await requireAdmin()
  const company = await getActiveCompany()
  if (!company) return { ok: false, error: 'No active company.' }

  const hostname = String(formData.get('hostname') ?? '')
    .trim()
    .toLowerCase()
  if (!HOSTNAME_PATTERN.test(hostname)) {
    return {
      ok: false,
      error:
        'Enter a full hostname like "portal.acme.com" (no scheme, no path).',
    }
  }
  if (hostname.endsWith(`.${getPlatformApexDomain()}`)) {
    return {
      ok: false,
      error:
        'That looks like a managed subdomain — use the Claim form above.',
    }
  }

  try {
    const domain = await prisma.domain.create({
      data: {
        companyId: company.id,
        hostname,
        kind: 'CUSTOM',
        isPrimary: false,
        verificationToken: newVerificationToken(),
      },
      select: {
        id: true,
        hostname: true,
        kind: true,
        isPrimary: true,
        verifiedAt: true,
        sslIssuedAt: true,
        verificationToken: true,
        createdAt: true,
      },
    })
    revalidatePath('/admin/settings')
    return { ok: true, domain }
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      return {
        ok: false,
        error: `${hostname} is already claimed by another tenant.`,
      }
    }
    console.error('startCustomDomainAction failed:', err)
    return { ok: false, error: 'Could not add custom domain' }
  }
}

export interface VerifyResult {
  ok: boolean
  error?: string
  domain?: DomainRow
  /** True when the DNS TXT record was found. */
  txtVerified?: boolean
  /** True when Vercel confirmed the domain is attached (SSL may
   *  still be in progress). */
  vercelAdded?: boolean
  /** True when Vercel's `getDomainStatus` says SSL is issued. */
  sslIssued?: boolean
  /** Reason why the flow stopped (used to render the right UI hint). */
  stage?:
    | 'not-found'
    | 'mismatch'
    | 'vercel-not-configured'
    | 'vercel-failed'
    | 'ssl-pending'
    | 'live'
}

/**
 * Probe TXT for the pending token; if found, register with Vercel;
 * fetch SSL status. Idempotent — re-running after any step reprises
 * from where it left off.
 */
export async function verifyCustomDomainAction(
  domainId: string,
): Promise<VerifyResult> {
  await requireAdmin()
  const company = await getActiveCompany()
  if (!company) return { ok: false, error: 'No active company.' }

  const row = await prisma.domain.findFirst({
    where: { id: domainId, companyId: company.id, kind: 'CUSTOM' },
  })
  if (!row) return { ok: false, error: 'Custom domain not found' }

  // 1. TXT check — skip if already verified.
  let txtVerified = row.verifiedAt !== null
  if (!txtVerified) {
    if (!row.verificationToken) {
      return { ok: false, error: 'Verification token missing (rotate?)' }
    }
    const records = await lookupVerificationTxt(row.hostname)
    if (records.length === 0) {
      return {
        ok: false,
        stage: 'not-found',
        error: `TXT record not visible yet at _kondense-verify.${row.hostname}. DNS can take a few minutes.`,
      }
    }
    if (!records.includes(row.verificationToken)) {
      return {
        ok: false,
        stage: 'mismatch',
        error:
          'TXT record found but the value does not match. Double-check the token you published.',
      }
    }
    txtVerified = true
    await prisma.domain.update({
      where: { id: row.id },
      data: { verifiedAt: new Date() },
    })
  }

  // 2. Vercel add.
  let vercelAdded = row.vercelDomainId !== null
  if (!vercelAdded) {
    if (!isVercelConfigured()) {
      return {
        ok: true,
        txtVerified: true,
        vercelAdded: false,
        stage: 'vercel-not-configured',
      }
    }
    const add = await addDomainToProject(row.hostname)
    if (!add.ok) {
      return {
        ok: false,
        stage: 'vercel-failed',
        txtVerified: true,
        vercelAdded: false,
        error: add.error,
      }
    }
    vercelAdded = true
    await prisma.domain.update({
      where: { id: row.id },
      data: { vercelDomainId: add.vercelDomainId },
    })
  }

  // 3. SSL status.
  const status = await getDomainStatus(row.hostname)
  if (!status.ok) {
    return {
      ok: true,
      txtVerified: true,
      vercelAdded: true,
      stage: 'ssl-pending',
      error: status.error,
    }
  }
  const sslIssued = status.sslIssued
  if (sslIssued && row.sslIssuedAt === null) {
    await prisma.domain.update({
      where: { id: row.id },
      data: { sslIssuedAt: new Date() },
    })
  }

  const refreshed = await prisma.domain.findUnique({
    where: { id: row.id },
    select: {
      id: true,
      hostname: true,
      kind: true,
      isPrimary: true,
      verifiedAt: true,
      sslIssuedAt: true,
      verificationToken: true,
      createdAt: true,
    },
  })
  revalidatePath('/admin/settings')
  return {
    ok: true,
    txtVerified: true,
    vercelAdded: true,
    sslIssued,
    stage: sslIssued ? 'live' : 'ssl-pending',
    domain: refreshed
      ? {
          ...refreshed,
          verificationToken:
            refreshed.kind === 'CUSTOM' && refreshed.verifiedAt === null
              ? refreshed.verificationToken
              : null,
        }
      : undefined,
  }
}

/**
 * Detach a domain from the tenant. Removes DB row + best-effort
 * un-registers from Vercel when it was previously attached. Errors
 * from Vercel are logged but don't block the DB delete.
 */
export async function removeDomainAction(
  domainId: string,
): Promise<DomainSaveResult> {
  await requireAdmin()
  const company = await getActiveCompany()
  if (!company) return { ok: false, error: 'No active company.' }

  const row = await prisma.domain.findFirst({
    where: { id: domainId, companyId: company.id },
  })
  if (!row) return { ok: false, error: 'Domain not found' }

  if (row.kind === 'CUSTOM' && row.vercelDomainId && isVercelConfigured()) {
    const rm = await removeDomainFromProject(row.hostname)
    if (!rm.ok) console.warn('vercel remove failed:', rm.error)
  }

  try {
    await prisma.domain.delete({ where: { id: domainId } })
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

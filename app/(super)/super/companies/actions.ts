'use server'

import { redirect } from 'next/navigation'
import type { Prisma } from '@prisma/client'

import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  CompanySlugConflictError,
  createCompany,
} from '@/lib/services/company-provisioning'
import { snapshotCompany } from '@/lib/services/company-snapshot'
import { setActiveCompanyCookie } from '@/lib/tenancy/active-company'
import { isTenancyEnabled } from '@/lib/tenancy/feature-flag'
import { runAsSuperAdmin } from '@/lib/tenancy/request-company'
import {
  createCompanySchema,
  snapshotCompanySchema,
} from '@/lib/validations/company'

import {
  COMPANY_DIRECTORY_PAGE_SIZE,
  type CompanyDirectoryData,
  type CompanyDirectoryQuery,
} from './types'

async function assertSuperAdmin(): Promise<void> {
  if (!isTenancyEnabled()) {
    throw new Error('unauthorized: tenancy disabled')
  }
  const user = await requireActiveUser()
  if (!user.isSuperAdmin) {
    throw new Error('unauthorized: super-admin only')
  }
}

/**
 * Server-driven search / filter / sort / pagination for
 * /super/companies. Runs inside runAsSuperAdmin so future scoped
 * Company queries stay unscoped for this surface.
 */
export async function fetchCompanies(
  query: CompanyDirectoryQuery,
): Promise<CompanyDirectoryData> {
  await assertSuperAdmin()
  const limit = COMPANY_DIRECTORY_PAGE_SIZE
  const skip = (query.page - 1) * limit

  const where: Prisma.CompanyWhereInput = {
    deletedAt: null,
    ...(query.kind === 'agency'
      ? { isAgency: true }
      : query.kind === 'sub'
        ? { isAgency: false }
        : {}),
    ...(query.search.trim().length > 0
      ? {
          OR: [
            { name: { contains: query.search.trim(), mode: 'insensitive' } },
            { slug: { contains: query.search.trim(), mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const orderBy: Prisma.CompanyOrderByWithRelationInput =
    query.sort === 'members'
      ? { memberships: { _count: query.direction } }
      : query.sort === 'name'
        ? { name: query.direction }
        : { createdAt: query.direction }

  return runAsSuperAdmin(async () => {
    const [total, companies] = await Promise.all([
      prisma.company.count({ where }),
      prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          name: true,
          slug: true,
          customDomain: true,
          isAgency: true,
          createdAt: true,
          _count: { select: { memberships: true } },
          memberships: {
            where: { role: 'OWNER' },
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { user: { select: { name: true, email: true } } },
          },
        },
      }),
    ])

    return {
      items: companies.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        customDomain: c.customDomain,
        isAgency: c.isAgency,
        createdAt: c.createdAt,
        memberCount: c._count.memberships,
        ownerName:
          c.memberships[0]?.user.name ??
          c.memberships[0]?.user.email.split('@')[0] ??
          null,
      })),
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    }
  })
}

export interface CreateCompanyResult {
  ok: boolean
  companyId?: string
  companySlug?: string
  ownerWasNewlyCreated?: boolean
  /** Populated only when snapshotFromCompanyId was set + succeeded. */
  snapshot?: {
    coursesCopied: number
    categoriesCopied: number
    lessonsCopied: number
  }
  /** Populated when the company was created but the snapshot pass
   *  failed. The company still exists; the admin can retry the
   *  clone from the row-level action. */
  snapshotError?: string
  error?: string
  fieldErrors?: Record<string, string[]>
}

/**
 * Super-admin creates a new tenant. Returns the created company's
 * id + slug on success. On validation failure, returns fieldErrors
 * so the client form can render inline messages.
 */
export async function createCompanyAction(
  input: unknown,
): Promise<CreateCompanyResult> {
  await assertSuperAdmin()

  const parsed = createCompanySchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key !== 'string') continue
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message]
    }
    return { ok: false, fieldErrors }
  }

  try {
    const result = await createCompany({
      name: parsed.data.name,
      slug: parsed.data.slug,
      isAgency: parsed.data.isAgency,
      owner: {
        email: parsed.data.ownerEmail,
        name: parsed.data.ownerName || undefined,
      },
    })

    // Optional snapshot pass. Failure here does NOT roll back the
    // company create — the tenant is real either way; the admin
    // can re-run the clone from the row action. Reporting the
    // error separately lets the toast reflect what actually
    // happened.
    let snapshotResult: CreateCompanyResult['snapshot']
    let snapshotError: string | undefined
    const sourceId = parsed.data.snapshotFromCompanyId?.trim()
    if (sourceId) {
      try {
        const summary = await snapshotCompany({
          sourceCompanyId: sourceId,
          targetCompanyId: result.company.id,
        })
        snapshotResult = {
          coursesCopied: summary.coursesCopied,
          categoriesCopied: summary.categoriesCopied,
          lessonsCopied: summary.lessonsCopied,
        }
      } catch (err) {
        console.error('snapshotCompany failed after create:', err)
        snapshotError =
          err instanceof Error ? err.message : 'Snapshot failed'
      }
    }

    return {
      ok: true,
      companyId: result.company.id,
      companySlug: result.company.slug,
      ownerWasNewlyCreated: result.ownerWasNewlyCreated,
      snapshot: snapshotResult,
      snapshotError,
    }
  } catch (err) {
    if (err instanceof CompanySlugConflictError) {
      return {
        ok: false,
        fieldErrors: { slug: ['This slug is already in use'] },
      }
    }
    console.error('createCompanyAction failed:', err)
    return { ok: false, error: 'Could not create company' }
  }
}

export interface SnapshotSourceOption {
  id: string
  name: string
  slug: string
  isAgency: boolean
}

/**
 * Companies eligible as a snapshot source. Excludes the target
 * (when supplied) so a caller can't try to clone a tenant into
 * itself from the picker. Runs inside runAsSuperAdmin so the
 * tenancy extension doesn't narrow the read.
 */
export async function listSnapshotSources(
  excludeCompanyId?: string,
): Promise<SnapshotSourceOption[]> {
  await assertSuperAdmin()
  return runAsSuperAdmin(async () => {
    const companies = await prisma.company.findMany({
      where: {
        deletedAt: null,
        ...(excludeCompanyId ? { id: { not: excludeCompanyId } } : {}),
      },
      orderBy: [{ isAgency: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        isAgency: true,
      },
    })
    return companies
  })
}

export interface SnapshotCompanyResult {
  ok: boolean
  summary?: {
    categoriesCopied: number
    coursesCopied: number
    modulesCopied: number
    chaptersCopied: number
    lessonsCopied: number
  }
  error?: string
}

/**
 * One-off snapshot from a source tenant into an existing target.
 * Runs the same snapshotCompany service as the create-time hook,
 * so the create-with-snapshot flow and the row-level "clone into"
 * flow use identical semantics.
 */
export async function snapshotCompanyAction(
  input: unknown,
): Promise<SnapshotCompanyResult> {
  await assertSuperAdmin()

  const parsed = snapshotCompanySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'Invalid snapshot input' }
  }
  if (parsed.data.sourceCompanyId === parsed.data.targetCompanyId) {
    return { ok: false, error: 'Source and target must be different companies' }
  }

  try {
    const summary = await snapshotCompany({
      sourceCompanyId: parsed.data.sourceCompanyId,
      targetCompanyId: parsed.data.targetCompanyId,
    })
    return { ok: true, summary }
  } catch (err) {
    console.error('snapshotCompanyAction failed:', err)
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Snapshot failed',
    }
  }
}

/**
 * Sets the caller's active-company cookie to the given tenant and
 * redirects into the admin console. Super-admin only — everyone
 * else gets bounced to /dashboard, matching the layout gate.
 */
export async function enterCompanyAction(formData: FormData) {
  if (!isTenancyEnabled()) redirect('/dashboard')

  const user = await requireActiveUser()
  if (!user.isSuperAdmin) redirect('/dashboard')

  const companyId = String(formData.get('companyId') ?? '')
  if (!companyId) redirect('/super/companies')

  const company = await prisma.company.findFirst({
    where: { id: companyId, deletedAt: null },
    select: { id: true },
  })
  if (!company) redirect('/super/companies')

  await setActiveCompanyCookie(company.id)
  redirect('/admin/dashboard')
}

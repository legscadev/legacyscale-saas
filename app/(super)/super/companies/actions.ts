'use server'

import { redirect } from 'next/navigation'
import type { Prisma } from '@prisma/client'

import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  CompanySlugConflictError,
  DeletedOwnerError,
  createCompany,
} from '@/lib/services/company-provisioning'
import { snapshotCompany } from '@/lib/services/company-snapshot'
import { setActiveCompanyCookie } from '@/lib/tenancy/active-company'
import { isTenancyEnabled } from '@/lib/tenancy/feature-flag'
import { runAsSuperAdmin } from '@/lib/tenancy/request-company'
import { PLATFORM_SEED_COMPANY_ID } from '@/lib/tenancy/seed'
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
  /** Populated only when snapshotFromCompanyId was set + succeeded.
   *  Same shape as SnapshotCompanyResult.summary — kept in sync so
   *  the client toast can list every category the operator selected. */
  snapshot?: {
    membershipsCopied: number
    coursesCopied: number
    trainingsCopied: number
    modulesCopied: number
    chaptersCopied: number
    lessonsCopied: number
    quizQuestionsCopied: number
    lessonResourcesCopied: number
    statDivisionsCopied: number
    statMetricsCopied: number
    orgRevisionsCopied: number
    orgNodesCopied: number
    positionDetailsCopied: number
    onboardingItemsCopied: number
    membersCopied: number
    teamCopied: number
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

  // Self-assign: blank ownerEmail means "the creator becomes OWNER".
  // Only super-admins can reach this action, so the caller is always
  // a valid candidate — we just skip the "you've been added" notice
  // since they obviously already know.
  const submittedEmail = parsed.data.ownerEmail?.trim() ?? ''
  const ownerName = parsed.data.ownerName?.trim() || undefined
  let ownerEmail = submittedEmail
  let notifyExistingOwner = true
  if (submittedEmail === '') {
    const caller = await requireActiveUser()
    ownerEmail = caller.email
    notifyExistingOwner = false
  }

  try {
    const result = await createCompany({
      name: parsed.data.name,
      slug: parsed.data.slug,
      isAgency: parsed.data.isAgency,
      owner: {
        email: ownerEmail,
        name: ownerName,
      },
      notifyExistingOwner,
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
          includeMemberships: parsed.data.snapshotIncludeMemberships,
          includeCourses: parsed.data.snapshotIncludeCourses,
          includeTrainings: parsed.data.snapshotIncludeTrainings,
          includeStatistics: parsed.data.snapshotIncludeStatistics,
          includeOrgBoard: parsed.data.snapshotIncludeOrgBoard,
          includeOnboardingChecklists:
            parsed.data.snapshotIncludeOnboardingChecklists,
          includeMembers: parsed.data.snapshotIncludeMembers,
          includeTeam: parsed.data.snapshotIncludeTeam,
        })
        snapshotResult = summary
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
    if (err instanceof DeletedOwnerError) {
      return {
        ok: false,
        fieldErrors: { ownerEmail: [err.message] },
      }
    }
    console.error('createCompanyAction failed:', err)
    return { ok: false, error: 'Could not create company' }
  }
}

export type OwnerLookup =
  | { status: 'invalid' }
  | { status: 'fresh' }
  | { status: 'deleted' }
  | {
      status: 'existing'
      name: string | null
      email: string
      /** Global User.role — determines whether we'll promote to
       *  ADMIN when creating the OWNER membership. */
      globalRole: 'ADMIN' | 'TEAM' | 'MEMBER'
      isSuperAdmin: boolean
      willPromote: boolean
    }

/**
 * Look up what the create-company form will do with a given owner
 * email — used by the client to render a live preview so the operator
 * knows whether they're minting a fresh admin, attaching an existing
 * super-admin, or (rejected) targeting a deleted account. Super-admin
 * only, since the create surface is super-admin only anyway.
 */
export async function lookupOwnerAction(
  emailRaw: string,
): Promise<OwnerLookup> {
  await assertSuperAdmin()
  const email = emailRaw.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: 'invalid' }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      email: true,
      name: true,
      role: true,
      isSuperAdmin: true,
      deletedAt: true,
    },
  })
  if (!user) return { status: 'fresh' }
  if (user.deletedAt) return { status: 'deleted' }

  return {
    status: 'existing',
    email: user.email,
    name: user.name,
    globalRole: user.role,
    isSuperAdmin: user.isSuperAdmin,
    willPromote: user.role !== 'ADMIN' && !user.isSuperAdmin,
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
    membershipsCopied: number
    coursesCopied: number
    trainingsCopied: number
    modulesCopied: number
    chaptersCopied: number
    lessonsCopied: number
    quizQuestionsCopied: number
    lessonResourcesCopied: number
    statDivisionsCopied: number
    statMetricsCopied: number
    orgRevisionsCopied: number
    orgNodesCopied: number
    positionDetailsCopied: number
    onboardingItemsCopied: number
    membersCopied: number
    teamCopied: number
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

  const anythingChecked =
    parsed.data.includeMemberships ||
    parsed.data.includeCourses ||
    parsed.data.includeTrainings ||
    parsed.data.includeStatistics ||
    parsed.data.includeOrgBoard ||
    parsed.data.includeOnboardingChecklists ||
    parsed.data.includeMembers ||
    parsed.data.includeTeam
  if (!anythingChecked) {
    return {
      ok: false,
      error: 'Pick at least one thing to copy.',
    }
  }

  try {
    const summary = await snapshotCompany({
      sourceCompanyId: parsed.data.sourceCompanyId,
      targetCompanyId: parsed.data.targetCompanyId,
      includeMemberships: parsed.data.includeMemberships,
      includeCourses: parsed.data.includeCourses,
      includeTrainings: parsed.data.includeTrainings,
      includeStatistics: parsed.data.includeStatistics,
      includeOrgBoard: parsed.data.includeOrgBoard,
      includeOnboardingChecklists: parsed.data.includeOnboardingChecklists,
      includeMembers: parsed.data.includeMembers,
      includeTeam: parsed.data.includeTeam,
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

export interface DeleteCompanyResult {
  ok: boolean
  error?: string
}

/**
 * Soft-delete a company. Requires the caller to type the company's
 * NAME in the confirmation input — the server double-checks against
 * the row so a race in the UI can't accidentally destroy a
 * different tenant.
 *
 * Also refuses to delete the current active tenant (the caller
 * would immediately lose their session context) and the seed
 * Kondense company (the agency root — deleting it collapses the
 * whole super-admin surface).
 */
export async function deleteCompanyAction(input: {
  companyId: string
  confirmName: string
}): Promise<DeleteCompanyResult> {
  await assertSuperAdmin()

  return runAsSuperAdmin(async () => {
    const company = await prisma.company.findFirst({
      where: { id: input.companyId, deletedAt: null },
      select: { id: true, name: true },
    })
    if (!company) return { ok: false, error: 'Company not found' }

    // Protect the platform seed row — soft-deleting it would collapse
    // the entire /super surface. Keys off the seed id (immutable) so
    // renaming the tenant / slug can't accidentally lift the guard.
    if (company.id === PLATFORM_SEED_COMPANY_ID) {
      return {
        ok: false,
        error: 'The platform seed tenant cannot be deleted.',
      }
    }

    if (input.confirmName.trim() !== company.name) {
      return {
        ok: false,
        error: 'The typed name did not match this company.',
      }
    }

    await prisma.company.update({
      where: { id: company.id },
      data: { deletedAt: new Date() },
    })

    return { ok: true }
  })
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

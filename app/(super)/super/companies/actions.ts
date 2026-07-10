'use server'

import { redirect } from 'next/navigation'
import type { Prisma } from '@prisma/client'

import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  CompanySlugConflictError,
  createCompany,
} from '@/lib/services/company-provisioning'
import { setActiveCompanyCookie } from '@/lib/tenancy/active-company'
import { isTenancyEnabled } from '@/lib/tenancy/feature-flag'
import { runAsSuperAdmin } from '@/lib/tenancy/request-company'
import { createCompanySchema } from '@/lib/validations/company'

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
    return {
      ok: true,
      companyId: result.company.id,
      companySlug: result.company.slug,
      ownerWasNewlyCreated: result.ownerWasNewlyCreated,
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

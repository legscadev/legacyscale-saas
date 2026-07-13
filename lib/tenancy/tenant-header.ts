// Tenant header helpers.
//
// The root middleware injects `x-tenant-slug` on each request when a
// caller passed `?tenant=<slug>` (dev-only stub; Phase 3 replaces
// this with host-based resolution). Server Components + route
// handlers read the header via these helpers.
//
// This is a *parallel* mechanism to `active_company_id` cookie. The
// cookie remains the persistence layer for the switcher UI; the
// header is an opt-in per-request override so future host-based
// resolution can flow through the same code path without a
// user-facing switcher click.
//
// Notes for Phase 3:
//   * The `x-tenant-id` header (real companyId, resolved from host)
//     will land here alongside `x-tenant-slug`. Consumers should
//     prefer id over slug once it exists.
//   * Company is not in the Prisma extension's SCOPED_MODELS list, so
//     `prisma.company.findFirst({ where: { slug } })` is safe to call
//     without a super-admin bypass.

import { headers } from 'next/headers'
import { cache } from 'react'
import type { Company } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { isTenancyEnabled } from './feature-flag'

const TENANT_SLUG_HEADER = 'x-tenant-slug'

/**
 * The tenant slug the middleware forwarded on this request, or null
 * when tenancy is off / no slug was passed. Cached per request.
 */
export const getTenantSlugFromHeaders = cache(
  async (): Promise<string | null> => {
    if (!isTenancyEnabled()) return null
    const h = await headers()
    return h.get(TENANT_SLUG_HEADER)
  },
)

/**
 * Resolve the Company row the caller pointed at via header. Null
 * when there's no header, the slug doesn't match a live company, or
 * tenancy is off. Cached per request.
 */
export const getTenantFromHeaders = cache(
  async (): Promise<Company | null> => {
    const slug = await getTenantSlugFromHeaders()
    if (!slug) return null
    return prisma.company.findFirst({ where: { slug, deletedAt: null } })
  },
)

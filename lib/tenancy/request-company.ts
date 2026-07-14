// Resolver that the Prisma extension consults on every scoped
// query. Returns:
//
//   null  → do not filter (flag off, no request context, or an
//           explicit super-admin bypass is in effect).
//   uuid  → filter reads + stamp writes with this company id.
//
// The bypass path uses Node's AsyncLocalStorage so super-admin
// cross-tenant flows (Phase 3) can run a callback whose Prisma
// queries touch every tenant. Preferred to a thread-local because
// Next.js server actions + route handlers all run on the same
// worker.

import { AsyncLocalStorage } from 'node:async_hooks'

import { getActiveCompany } from './active-company'
import { isTenancyEnabled } from './feature-flag'

/** Cross-tenant escape hatch used by withSuperAdminContext. */
const bypassStore = new AsyncLocalStorage<{ superAdmin: true }>()

/**
 * Read the active company for the current request. Returns null on:
 *   - tenancy flag off
 *   - no request context (seed scripts, background jobs)
 *   - inside a runAsSuperAdmin() callback
 *
 * Deliberately NOT wrapped in React's cache() — the AsyncLocalStorage
 * bypass check needs to run on every call, or a super-admin flow that
 * opens after the layout has already resolved the active company will
 * still see the cached tenant id (extension keeps scoping queries
 * that were supposed to run cross-tenant). The underlying
 * getActiveCompany() is itself cache()-wrapped, so we still avoid
 * duplicate DB lookups per request.
 */
export async function getRequestCompanyId(): Promise<string | null> {
  if (!isTenancyEnabled()) return null
  if (bypassStore.getStore()) return null

  try {
    const company = await getActiveCompany()
    return company?.id ?? null
  } catch {
    // getActiveCompany() reads cookies + auth, both of which throw
    // outside a request context. Falling back to null preserves the
    // pre-refactor behavior for CLI + job callers.
    return null
  }
}

/**
 * Run a callback with the tenant filter disabled — every scoped
 * Prisma query in the callback sees every tenant. Callers are
 * responsible for ensuring this only runs behind a super-admin
 * auth check (Phase 3 super-admin console).
 */
export function runAsSuperAdmin<T>(fn: () => Promise<T>): Promise<T> {
  return bypassStore.run({ superAdmin: true }, fn)
}

/**
 * Users are global (not tenant-scoped), so the Prisma extension
 * can't fill in a companyId filter. Any list-style user query in
 * an admin surface asks "which users hold a membership in the
 * active company?" — that's this helper. Returns undefined when
 * the flag is off so callers degrade to the pre-refactor path.
 *
 * Callers spread this into their `where` clause:
 *   const tenantFilter = await memberTenantScope()
 *   prisma.user.findMany({ where: { ...tenantFilter, ... } })
 */
export async function memberTenantScope(): Promise<
  { companyMemberships: { some: { companyId: string } } } | undefined
> {
  const companyId = await getRequestCompanyId()
  if (!companyId) return undefined
  return { companyMemberships: { some: { companyId } } }
}

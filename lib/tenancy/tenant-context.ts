// Runs a Prisma callback with the Postgres session variable
// `app.company_id` set to the current tenant. That variable is what
// tenant-scoped RLS policies key on — see prisma/tenancy-rls.sql.
//
// The primary tenant filter in Phase 2 is app-layer: every service
// adds `where: { companyId }` explicitly. This helper is the
// defense-in-depth layer for when we flip the Prisma role off
// BYPASSRLS (post-2.7). Until then, calling withTenantContext is
// safe but a no-op for RLS enforcement.
//
// Usage:
//   await withTenantContext(companyId, (tx) =>
//     tx.course.findMany({ where: { companyId } })
//   )
//
// The callback receives a transaction client — DO NOT reuse the
// outer `prisma` inside because the SET LOCAL only binds to this
// transaction's connection.

import type { Prisma, PrismaClient } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { isTenancyEnabled } from './feature-flag'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

/**
 * Execute `fn` in a Prisma transaction whose Postgres session has
 * `app.company_id = <companyId>`. Falls through to a plain call
 * when the tenancy flag is off — old callers keep working.
 */
export async function withTenantContext<T>(
  companyId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (!isTenancyEnabled()) {
    return fn(prisma as unknown as Prisma.TransactionClient)
  }

  if (!UUID_RE.test(companyId)) {
    throw new Error(
      `withTenantContext: refusing to set app.company_id to non-UUID value`,
    )
  }

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.company_id', ${companyId}, true)`
    return fn(tx)
  })
}

/**
 * Run `fn` with the session variable cleared — used for super-admin
 * queries that legitimately span every tenant (Phase 3 super-admin
 * console, cross-tenant aggregates). The RLS policies treat NULL as
 * "pass through" for callers whose row-in-users carries
 * is_super_admin = true.
 */
export async function withSuperAdminContext<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (!isTenancyEnabled()) {
    return fn(prisma as unknown as Prisma.TransactionClient)
  }
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.company_id', NULL, true)`
    return fn(tx)
  })
}

// Suppress unused type — TxClient is exported for downstream typing
// once services adopt the helper in 2.3+.
export type { TxClient }

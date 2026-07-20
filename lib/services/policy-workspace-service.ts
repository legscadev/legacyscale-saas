// Per-tenant workspace bootstrap for the Policies module.
//
// Policies don't hard-require a category (FK is SetNull), but the
// admin list-view surfaces category as its primary grouping axis —
// zero categories means an empty filter dropdown on first render.
// This service seeds a Makh-inspired starter set the first time a
// tenant opens /admin/policies. Admins can rename/delete/add from
// the workflow-admin surface later.
//
// Idempotent: short-circuits when any PolicyCategory row already
// exists for the tenant. Runs inside runAsSuperAdmin so the tenancy
// extension steps out of the way for the cross-check + insert.

import { prisma } from '@/lib/prisma'
import { runAsSuperAdmin } from '@/lib/tenancy/request-company'
import type { UpsertPolicyCategoryInput } from '@/lib/validations/policy'

/** Cross-role starter categories. Matches how Makh groups hat
 *  write-ups + process docs — role hats dominate but process /
 *  systems / onboarding are common enough to seed. Admins can add
 *  their own from the workflow-admin surface. */
const DEFAULT_CATEGORIES = [
  { name: 'Role Hats',  color: '#3b82f6' },
  { name: 'Processes',  color: '#22c55e' },
  { name: 'Systems',    color: '#8b5cf6' },
  { name: 'Onboarding', color: '#f59e0b' },
] as const

export interface PolicyWorkspaceSeedResult {
  categoriesCreated: number
}

/**
 * Seed defaults for the given tenant if they don't yet exist. Safe
 * to re-run — the "any row already exists?" check means a partial
 * state (admin deleted one, kept others) still gets left alone on
 * subsequent runs. This is only meant to bootstrap fresh tenants,
 * not repair drift.
 */
export async function seedDefaultPolicyWorkspace(
  companyId: string,
): Promise<PolicyWorkspaceSeedResult> {
  return runAsSuperAdmin(async () => {
    const existing = await prisma.policyCategory.count({ where: { companyId } })
    if (existing > 0) return { categoriesCreated: 0 }

    await prisma.policyCategory.createMany({
      data: DEFAULT_CATEGORIES.map((c) => ({ ...c, companyId })),
    })
    return { categoriesCreated: DEFAULT_CATEGORIES.length }
  })
}

/**
 * Lazy-seed guard for the policies entry pages. Called from the
 * list-view server component — the check is a single COUNT and
 * the seed only runs when the tenant is genuinely empty, so this
 * is cheap on every subsequent render.
 */
export async function ensurePolicyWorkspaceReady(
  companyId: string,
): Promise<void> {
  const existing = await runAsSuperAdmin(() =>
    prisma.policyCategory.count({ where: { companyId } }),
  )
  if (existing > 0) return
  await seedDefaultPolicyWorkspace(companyId)
}

// ============================================
// CRUD for admin surfaces (Phase 6)
// ============================================

export interface PolicyCategoryListItem {
  id: string
  name: string
  color: string
  /** How many non-deleted policies currently sit in this category.
   *  Drives the "in use" warning on the delete confirmation. */
  policyCount: number
}

class PolicyCategoryAdminService {
  async list(): Promise<PolicyCategoryListItem[]> {
    const rows = await prisma.policyCategory.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            policies: { where: { deletedAt: null } },
          },
        },
      },
    })
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      policyCount: c._count.policies,
    }))
  }

  async upsert(
    input: UpsertPolicyCategoryInput,
  ): Promise<PolicyCategoryListItem> {
    if (input.id) {
      const row = await prisma.policyCategory.update({
        where: { id: input.id },
        data: { name: input.name, color: input.color },
        include: {
          _count: {
            select: { policies: { where: { deletedAt: null } } },
          },
        },
      })
      return {
        id: row.id,
        name: row.name,
        color: row.color,
        policyCount: row._count.policies,
      }
    }
    const row = await prisma.policyCategory.create({
      data: { name: input.name, color: input.color },
      include: {
        _count: {
          select: { policies: { where: { deletedAt: null } } },
        },
      },
    })
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      policyCount: row._count.policies,
    }
  }

  /** Categories are optional on policies (FK is SetNull), so a
   *  delete simply detaches the association from any policies
   *  holding it. */
  async delete(id: string): Promise<void> {
    await prisma.policyCategory.delete({ where: { id } })
  }
}

export const policyCategoryAdminService = new PolicyCategoryAdminService()

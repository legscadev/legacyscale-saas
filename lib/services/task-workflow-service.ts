// Per-tenant workflow bootstrap for the Internal Task Tracker.
//
// Every tenant needs at least one TaskStatus row before a task can be
// created — the FK on tasks.status_id is Restrict, not SetNull. This
// service seeds a sensible starter workflow (Backlog → To Do → In
// Progress → In Review → Blocked → Done) plus a small palette of
// labels and categories the first time a tenant opens the tracker.
//
// Idempotent: the seed short-circuits if any TaskStatus row already
// exists for the tenant. Callers can also opt into seeding labels /
// categories independently — useful for later "restore defaults"
// buttons. Runs inside runAsSuperAdmin so the tenancy extension
// steps out of the way while we cross-check + insert on behalf of
// whichever tenant is active.

import { prisma } from '@/lib/prisma'
import { runAsSuperAdmin } from '@/lib/tenancy/request-company'

/** Six starter statuses covering the common workflow. Ordered by
 *  orderIndex; `To Do` is the default target for freshly-created
 *  tasks; `Done` is the terminal state. Custom stages (In Review,
 *  Testing, Custom) can be added by admins later without touching
 *  code. */
const DEFAULT_STATUSES = [
  { name: 'Backlog',     slug: 'backlog',      color: '#64748b', orderIndex: 0, isDefault: false, isTerminal: false },
  { name: 'To Do',       slug: 'todo',         color: '#3b82f6', orderIndex: 1, isDefault: true,  isTerminal: false },
  { name: 'In Progress', slug: 'in-progress',  color: '#f59e0b', orderIndex: 2, isDefault: false, isTerminal: false },
  { name: 'In Review',   slug: 'in-review',    color: '#a855f7', orderIndex: 3, isDefault: false, isTerminal: false },
  { name: 'Blocked',     slug: 'blocked',      color: '#ef4444', orderIndex: 4, isDefault: false, isTerminal: false },
  { name: 'Done',        slug: 'done',         color: '#22c55e', orderIndex: 5, isDefault: false, isTerminal: true  },
] as const

/** Common engineering / delivery categories. Admins can rename or
 *  delete these from the workflow-admin surface (Phase 6). */
const DEFAULT_CATEGORIES = [
  { name: 'Bug',           color: '#ef4444' },
  { name: 'Feature',       color: '#22c55e' },
  { name: 'Enhancement',   color: '#3b82f6' },
  { name: 'Documentation', color: '#8b5cf6' },
  { name: 'Ops',           color: '#f59e0b' },
] as const

/** Cross-cutting labels usable across categories. */
const DEFAULT_LABELS = [
  { name: 'backend',        color: '#0ea5e9' },
  { name: 'frontend',       color: '#ec4899' },
  { name: 'database',       color: '#f59e0b' },
  { name: 'api',            color: '#8b5cf6' },
  { name: 'infrastructure', color: '#64748b' },
  { name: 'urgent',         color: '#ef4444' },
] as const

export interface WorkflowSeedResult {
  statusesCreated: number
  categoriesCreated: number
  labelsCreated: number
}

/**
 * Seed defaults for the given tenant if they don't yet exist. Safe to
 * re-run: each block is guarded by an "any row already exists?" check
 * so partial state (e.g. admin deleted a status but didn't wipe
 * labels) still gets the missing pieces on next run.
 */
export async function seedDefaultWorkflow(
  companyId: string,
): Promise<WorkflowSeedResult> {
  return runAsSuperAdmin(async () => {
    const [existingStatuses, existingCategories, existingLabels] =
      await Promise.all([
        prisma.taskStatus.count({ where: { companyId } }),
        prisma.taskCategory.count({ where: { companyId } }),
        prisma.taskLabel.count({ where: { companyId } }),
      ])

    let statusesCreated = 0
    let categoriesCreated = 0
    let labelsCreated = 0

    if (existingStatuses === 0) {
      await prisma.taskStatus.createMany({
        data: DEFAULT_STATUSES.map((s) => ({ ...s, companyId })),
      })
      statusesCreated = DEFAULT_STATUSES.length
    }
    if (existingCategories === 0) {
      await prisma.taskCategory.createMany({
        data: DEFAULT_CATEGORIES.map((c) => ({ ...c, companyId })),
      })
      categoriesCreated = DEFAULT_CATEGORIES.length
    }
    if (existingLabels === 0) {
      await prisma.taskLabel.createMany({
        data: DEFAULT_LABELS.map((l) => ({ ...l, companyId })),
      })
      labelsCreated = DEFAULT_LABELS.length
    }

    return { statusesCreated, categoriesCreated, labelsCreated }
  })
}

/**
 * Lazy-seed guard for the tracker's entry pages. Called from the
 * list-view server component — if the tenant has zero statuses, seed
 * before the page renders so the operator never sees a "no columns"
 * board on first visit. No-op when the workflow is already set up.
 */
export async function ensureWorkflowReady(companyId: string): Promise<void> {
  const existing = await runAsSuperAdmin(() =>
    prisma.taskStatus.count({ where: { companyId } }),
  )
  if (existing > 0) return
  await seedDefaultWorkflow(companyId)
}

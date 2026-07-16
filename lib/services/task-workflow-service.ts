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
import {
  getRequestCompanyId,
  runAsSuperAdmin,
} from '@/lib/tenancy/request-company'
import type {
  UpsertCategoryInput,
  UpsertLabelInput,
  UpsertStatusInput,
} from '@/lib/validations/tasks'

export class StatusInUseError extends Error {
  constructor(message = 'Cannot delete a status that still holds tasks') {
    super(message)
    this.name = 'StatusInUseError'
  }
}

export class LastStatusError extends Error {
  constructor(message = 'A tenant must keep at least one status') {
    super(message)
    this.name = 'LastStatusError'
  }
}

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

// ============================================
// CRUD for admin surfaces (Phase 6)
// ============================================

async function requireCompanyId(): Promise<string> {
  const id = await getRequestCompanyId()
  if (!id) throw new Error('task-workflow-service: no active company')
  return id
}

export interface StatusListItem {
  id: string
  name: string
  slug: string
  color: string
  orderIndex: number
  isDefault: boolean
  isTerminal: boolean
  wipLimit: number | null
  /** How many non-archived, non-deleted tasks currently sit in this
   *  status. Drives the "in use" warning on delete + the empty-row
   *  affordance in the admin table. */
  taskCount: number
}

export interface CategoryListItem {
  id: string
  name: string
  color: string
  taskCount: number
}

export interface LabelListItem {
  id: string
  name: string
  color: string
  taskCount: number
}

class TaskWorkflowAdminService {
  // -------- STATUSES --------

  async listStatuses(): Promise<StatusListItem[]> {
    const statuses = await prisma.taskStatus.findMany({
      orderBy: { orderIndex: 'asc' },
      include: {
        _count: {
          select: {
            tasks: {
              where: { deletedAt: null, archivedAt: null },
            },
          },
        },
      },
    })
    return statuses.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      color: s.color,
      orderIndex: s.orderIndex,
      isDefault: s.isDefault,
      isTerminal: s.isTerminal,
      wipLimit: s.wipLimit,
      taskCount: s._count.tasks,
    }))
  }

  /**
   * Create or update a status. If isDefault is flipped on we clear
   * it on every other row in the same tenant — the workspace layer
   * assumes exactly one default status exists.
   */
  async upsertStatus(input: UpsertStatusInput): Promise<StatusListItem> {
    const companyId = await requireCompanyId()

    const upserted = await prisma.$transaction(async (tx) => {
      // Sole-default guarantee.
      if (input.isDefault) {
        await tx.taskStatus.updateMany({
          where: { companyId, isDefault: true, ...(input.id ? { NOT: { id: input.id } } : {}) },
          data: { isDefault: false },
        })
      }

      if (input.id) {
        return tx.taskStatus.update({
          where: { id: input.id },
          data: {
            name: input.name,
            slug: input.slug,
            color: input.color,
            orderIndex: input.orderIndex,
            isDefault: input.isDefault,
            isTerminal: input.isTerminal,
            wipLimit: input.wipLimit ?? null,
          },
        })
      }

      // Nested create — the tenancy extension only auto-stamps
      // top-level writes, but the field default handles the rest.
      return tx.taskStatus.create({
        data: {
          name: input.name,
          slug: input.slug,
          color: input.color,
          orderIndex: input.orderIndex,
          isDefault: input.isDefault,
          isTerminal: input.isTerminal,
          wipLimit: input.wipLimit ?? null,
        },
      })
    }, { timeout: 15_000 })

    const withCount = await prisma.taskStatus.findUnique({
      where: { id: upserted.id },
      include: {
        _count: {
          select: {
            tasks: { where: { deletedAt: null, archivedAt: null } },
          },
        },
      },
    })
    if (!withCount) throw new Error('Status vanished after upsert')
    return {
      id: withCount.id,
      name: withCount.name,
      slug: withCount.slug,
      color: withCount.color,
      orderIndex: withCount.orderIndex,
      isDefault: withCount.isDefault,
      isTerminal: withCount.isTerminal,
      wipLimit: withCount.wipLimit,
      taskCount: withCount._count.tasks,
    }
  }

  /**
   * Delete a status. Blocked if any task still references it
   * (Restrict FK) — the admin has to move those tasks first.
   * Also blocked if this is the last status in the tenant, which
   * would leave no drop target for new tasks.
   */
  async deleteStatus(id: string): Promise<void> {
    const [row, totalStatuses] = await Promise.all([
      prisma.taskStatus.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              tasks: { where: { deletedAt: null } },
            },
          },
        },
      }),
      prisma.taskStatus.count(),
    ])
    if (!row) throw new Error('Status not found')
    if (row._count.tasks > 0) throw new StatusInUseError()
    if (totalStatuses <= 1) throw new LastStatusError()
    await prisma.taskStatus.delete({ where: { id } })
  }

  /** Rewrite orderIndex for the tenant's statuses. Caller sends the
   *  desired order as an id array. */
  async reorderStatuses(ids: string[]): Promise<void> {
    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.taskStatus.update({
          where: { id },
          data: { orderIndex: index },
        }),
      ),
    )
  }

  // -------- CATEGORIES --------

  async listCategories(): Promise<CategoryListItem[]> {
    const rows = await prisma.taskCategory.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            tasks: { where: { deletedAt: null } },
          },
        },
      },
    })
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      taskCount: c._count.tasks,
    }))
  }

  async upsertCategory(input: UpsertCategoryInput): Promise<CategoryListItem> {
    if (input.id) {
      const row = await prisma.taskCategory.update({
        where: { id: input.id },
        data: { name: input.name, color: input.color },
        include: {
          _count: { select: { tasks: { where: { deletedAt: null } } } },
        },
      })
      return {
        id: row.id,
        name: row.name,
        color: row.color,
        taskCount: row._count.tasks,
      }
    }
    const row = await prisma.taskCategory.create({
      data: { name: input.name, color: input.color },
      include: {
        _count: { select: { tasks: { where: { deletedAt: null } } } },
      },
    })
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      taskCount: row._count.tasks,
    }
  }

  /** Categories are optional on tasks (FK is SetNull), so a delete
   *  simply detaches the association from any tasks holding it. */
  async deleteCategory(id: string): Promise<void> {
    await prisma.taskCategory.delete({ where: { id } })
  }

  // -------- LABELS --------

  async listLabels(): Promise<LabelListItem[]> {
    const rows = await prisma.taskLabel.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { links: true },
        },
      },
    })
    return rows.map((l) => ({
      id: l.id,
      name: l.name,
      color: l.color,
      taskCount: l._count.links,
    }))
  }

  async upsertLabel(input: UpsertLabelInput): Promise<LabelListItem> {
    if (input.id) {
      const row = await prisma.taskLabel.update({
        where: { id: input.id },
        data: { name: input.name, color: input.color },
        include: { _count: { select: { links: true } } },
      })
      return {
        id: row.id,
        name: row.name,
        color: row.color,
        taskCount: row._count.links,
      }
    }
    const row = await prisma.taskLabel.create({
      data: { name: input.name, color: input.color },
      include: { _count: { select: { links: true } } },
    })
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      taskCount: row._count.links,
    }
  }

  /** Labels cascade-delete on the join table, so a delete quietly
   *  detaches from every task that carried it. */
  async deleteLabel(id: string): Promise<void> {
    await prisma.taskLabel.delete({ where: { id } })
  }
}

export const taskWorkflowAdminService = new TaskWorkflowAdminService()

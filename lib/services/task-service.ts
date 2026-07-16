// Task CRUD + list/filter for the Internal Task Tracker.
//
// The service owns the write path for Task rows, its M:N joins
// (assignees / watchers / labels), and archive/restore/duplicate.
// Comment + checklist mutations live in their own services so the
// per-file surface stays under 300 lines.
//
// Tenant scoping is handled by the Prisma extension for top-level
// operations. Nested writes (labelLinks.create inside a task.update)
// are NOT auto-stamped — we resolve companyId once at the top of
// each write and pass it explicitly into the nested rows.

import type { Prisma, TaskPriority } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import {
  logDiffIfChanged,
  taskActivityService,
} from '@/lib/services/task-activity-service'
import { getRequestCompanyId } from '@/lib/tenancy/request-company'
import type {
  CreateTaskInput,
  TaskFilterOutput,
  TaskPriorityValue,
  UpdateTaskInput,
} from '@/lib/validations/tasks'
import { TASK_PRIORITY_ORDER } from '@/lib/validations/tasks'

/**
 * Per-service not-found sentinel. The codebase doesn't have a shared
 * error hierarchy yet — action handlers branch on `instanceof
 * TaskNotFoundError` to return a 404-shaped response.
 */
export class TaskNotFoundError extends Error {
  constructor(message = 'Task not found') {
    super(message)
    this.name = 'TaskNotFoundError'
  }
}

// ============================================
// PUBLIC SHAPES
// ============================================

/** Compact user projection used in every task-related list response. */
export interface TaskUserRef {
  id: string
  name: string | null
  email: string
}

/** Row shape for both the list view + the Kanban card. Keep it
 *  serializable — no Date-in-Date-out helpers, no methods. */
export interface TaskListItem {
  id: string
  title: string
  description: string | null
  priority: TaskPriority
  statusId: string
  status: {
    id: string
    name: string
    slug: string
    color: string
    orderIndex: number
    isTerminal: boolean
  }
  categoryId: string | null
  category: { id: string; name: string; color: string } | null
  reporter: TaskUserRef | null
  assignees: TaskUserRef[]
  labels: Array<{ id: string; name: string; color: string }>
  parentTaskId: string | null
  startDate: Date | null
  dueDate: Date | null
  estimatedHours: number | null
  actualHours: number | null
  orderIndex: number
  commentCount: number
  attachmentCount: number
  subtaskCount: number
  checklistTotal: number
  checklistDone: number
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface TaskListResult {
  items: TaskListItem[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasMore: boolean
}

/** Full detail shape returned by get() — same as list, plus the
 *  richer collections the drawer renders (comments + checklists +
 *  attachments + watchers + activity are loaded on demand by their
 *  own services). */
export interface TaskDetail extends TaskListItem {
  watchers: TaskUserRef[]
  parentTask: { id: string; title: string } | null
  subtasks: Array<{
    id: string
    title: string
    statusId: string
    statusName: string
    priority: TaskPriority
  }>
}

// ============================================
// PRIVATE HELPERS
// ============================================

/**
 * Shared include shape. Keeping one canonical include means the row
 * mapper below stays type-safe against the Prisma payload without
 * having to hand-write half a dozen intersection types.
 */
const TASK_INCLUDE = {
  status: {
    select: {
      id: true,
      name: true,
      slug: true,
      color: true,
      orderIndex: true,
      isTerminal: true,
    },
  },
  category: { select: { id: true, name: true, color: true } },
  reporter: { select: { id: true, name: true, email: true } },
  assignees: {
    include: { user: { select: { id: true, name: true, email: true } } },
  },
  labels: {
    include: { label: { select: { id: true, name: true, color: true } } },
  },
  _count: {
    select: {
      comments: true,
      attachments: true,
      subtasks: true,
    },
  },
  checklists: { select: { items: { select: { isDone: true } } } },
} as const satisfies Prisma.TaskInclude

const TASK_DETAIL_INCLUDE = {
  ...TASK_INCLUDE,
  watchers: {
    include: { user: { select: { id: true, name: true, email: true } } },
  },
  parentTask: { select: { id: true, title: true } },
  subtasks: {
    where: { deletedAt: null },
    select: {
      id: true,
      title: true,
      statusId: true,
      priority: true,
      status: { select: { name: true } },
    },
    orderBy: { orderIndex: 'asc' },
  },
} as const satisfies Prisma.TaskInclude

type TaskWithIncludes = Prisma.TaskGetPayload<{ include: typeof TASK_INCLUDE }>
type TaskWithDetailIncludes = Prisma.TaskGetPayload<{
  include: typeof TASK_DETAIL_INCLUDE
}>

/** Decimal → number | null. Prisma returns Decimal for @db.Decimal
 *  columns; the client wants plain numbers. */
function decToNum(d: Prisma.Decimal | null | undefined): number | null {
  if (d === null || d === undefined) return null
  return Number(d)
}

function mapListRow(t: TaskWithIncludes): TaskListItem {
  const checklistTotal = t.checklists.reduce(
    (sum, c) => sum + c.items.length,
    0,
  )
  const checklistDone = t.checklists.reduce(
    (sum, c) => sum + c.items.filter((i) => i.isDone).length,
    0,
  )
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    priority: t.priority,
    statusId: t.statusId,
    status: t.status,
    categoryId: t.categoryId,
    category: t.category,
    reporter: t.reporter,
    assignees: t.assignees.map((a) => a.user),
    labels: t.labels.map((l) => l.label),
    parentTaskId: t.parentTaskId,
    startDate: t.startDate,
    dueDate: t.dueDate,
    estimatedHours: decToNum(t.estimatedHours),
    actualHours: decToNum(t.actualHours),
    orderIndex: t.orderIndex,
    commentCount: t._count.comments,
    attachmentCount: t._count.attachments,
    subtaskCount: t._count.subtasks,
    checklistTotal,
    checklistDone,
    archivedAt: t.archivedAt,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }
}

function mapDetail(t: TaskWithDetailIncludes): TaskDetail {
  const base = mapListRow(t as unknown as TaskWithIncludes)
  return {
    ...base,
    watchers: t.watchers.map((w) => w.user),
    parentTask: t.parentTask,
    subtasks: t.subtasks.map((s) => ({
      id: s.id,
      title: s.title,
      statusId: s.statusId,
      statusName: s.status.name,
      priority: s.priority,
    })),
  }
}

/** Every write eventually needs the active companyId (to stamp
 *  nested rows). Throws in contexts that don't have one — task
 *  writes are always tenant-scoped, no legitimate anonymous caller. */
async function requireCompanyId(): Promise<string> {
  const id = await getRequestCompanyId()
  if (!id) {
    throw new Error(
      'task-service: no active company in request context',
    )
  }
  return id
}

/** Resolve the tenant's default status when the caller didn't pick
 *  one. Falls back to the lowest orderIndex if `isDefault` is unset. */
async function resolveDefaultStatusId(companyId: string): Promise<string> {
  const preferred = await prisma.taskStatus.findFirst({
    where: { companyId, isDefault: true },
    select: { id: true },
  })
  if (preferred) return preferred.id

  const fallback = await prisma.taskStatus.findFirst({
    where: { companyId },
    orderBy: { orderIndex: 'asc' },
    select: { id: true },
  })
  if (!fallback) {
    throw new Error(
      'No task statuses configured. Seed the default workflow first.',
    )
  }
  return fallback.id
}

/** Next orderIndex within a column — new tasks land at the bottom. */
async function nextOrderIndex(
  companyId: string,
  statusId: string,
): Promise<number> {
  const last = await prisma.task.findFirst({
    where: { companyId, statusId, deletedAt: null },
    orderBy: { orderIndex: 'desc' },
    select: { orderIndex: true },
  })
  return (last?.orderIndex ?? 0) + 100
}

/** Priority sort — Prisma can't order by our custom index, so we
 *  bring the rows back then sort in-memory when priority is the key.
 *  Cheap because list results are capped at 100. */
function sortByPriority(
  rows: TaskListItem[],
  order: 'asc' | 'desc',
): TaskListItem[] {
  return [...rows].sort((a, b) => {
    const av = TASK_PRIORITY_ORDER[a.priority as TaskPriorityValue]
    const bv = TASK_PRIORITY_ORDER[b.priority as TaskPriorityValue]
    return order === 'asc' ? av - bv : bv - av
  })
}

// ============================================
// SERVICE
// ============================================

class TaskService {
  /**
   * Paginated list with filters. Sort is server-side except for
   * `priority`, which is normalized in-memory (see sortByPriority).
   */
  async list(filters: TaskFilterOutput): Promise<TaskListResult> {
    const { page, limit, sortBy, sortOrder, includeArchived } = filters
    const skip = (page - 1) * limit

    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
      ...(includeArchived ? {} : { archivedAt: null }),
    }

    if (filters.search?.trim()) {
      const q = filters.search.trim()
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ]
    }
    if (filters.statusIds?.length) {
      where.statusId = { in: filters.statusIds }
    }
    if (filters.priorities?.length) {
      where.priority = { in: filters.priorities }
    }
    if (filters.categoryIds?.length) {
      where.categoryId = { in: filters.categoryIds }
    }
    if (filters.labelIds?.length) {
      where.labels = { some: { labelId: { in: filters.labelIds } } }
    }
    if (filters.assigneeIds?.length) {
      where.assignees = { some: { userId: { in: filters.assigneeIds } } }
    }
    if (filters.reporterIds?.length) {
      where.reporterId = { in: filters.reporterIds }
    }
    if (filters.dueBefore || filters.dueAfter) {
      where.dueDate = {
        ...(filters.dueAfter && { gte: filters.dueAfter }),
        ...(filters.dueBefore && { lte: filters.dueBefore }),
      }
    }

    // Priority sort needs in-memory reorder AFTER pagination is applied
    // in DB-time (since we can't sort by our custom order in SQL).
    // For the common case (createdAt / dueDate / updated / order) we
    // let Prisma do the work.
    const orderBy: Prisma.TaskOrderByWithRelationInput =
      sortBy === 'priority'
        ? { createdAt: sortOrder }
        : { [sortBy]: sortOrder }

    const [rows, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: TASK_INCLUDE,
      }),
      prisma.task.count({ where }),
    ])

    let items = rows.map(mapListRow)
    if (sortBy === 'priority') items = sortByPriority(items, sortOrder)

    const totalPages = Math.ceil(total / limit)
    return {
      items,
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    }
  }

  async get(id: string): Promise<TaskDetail> {
    const task = await prisma.task.findFirst({
      where: { id, deletedAt: null },
      include: TASK_DETAIL_INCLUDE,
    })
    if (!task) throw new TaskNotFoundError('Task not found')
    return mapDetail(task)
  }

  async create(
    input: CreateTaskInput,
    reporterId: string | null,
  ): Promise<TaskDetail> {
    const companyId = await requireCompanyId()
    const statusId = input.statusId ?? (await resolveDefaultStatusId(companyId))
    const orderIndex = await nextOrderIndex(companyId, statusId)

    const priority = input.priority ?? 'MEDIUM'
    const assigneeIds = input.assigneeIds ?? []
    const watcherIds = input.watcherIds ?? []
    const labelIds = input.labelIds ?? []

    // Reporter is auto-added as a watcher so status updates + comments
    // route back to them without an extra opt-in step.
    const watcherSet = new Set(watcherIds)
    if (reporterId) watcherSet.add(reporterId)

    const created = await prisma.task.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        statusId,
        priority,
        categoryId: input.categoryId ?? null,
        parentTaskId: input.parentTaskId ?? null,
        reporterId,
        startDate: input.startDate ?? null,
        dueDate: input.dueDate ?? null,
        estimatedHours: input.estimatedHours ?? null,
        orderIndex,
        // Nested creates aren't touched by the tenancy extension —
        // stamp companyId explicitly on every join row.
        assignees: {
          create: assigneeIds.map((userId) => ({ userId, companyId })),
        },
        watchers: {
          create: Array.from(watcherSet).map((userId) => ({
            userId,
            companyId,
          })),
        },
        labels: {
          create: labelIds.map((labelId) => ({ labelId, companyId })),
        },
      },
      select: { id: true },
    })

    await taskActivityService.logEvent({
      taskId: created.id,
      actorId: reporterId,
      action: 'created',
      toValue: {
        title: input.title,
        statusId,
        priority,
        assigneeCount: assigneeIds.length,
      },
    })

    return this.get(created.id)
  }

  async update(
    id: string,
    input: UpdateTaskInput,
    actorId: string | null,
  ): Promise<TaskDetail> {
    const companyId = await requireCompanyId()
    const existing = await prisma.task.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        statusId: true,
        priority: true,
        categoryId: true,
        dueDate: true,
        assignees: { select: { userId: true } },
        watchers: { select: { userId: true } },
        labels: { select: { labelId: true } },
      },
    })
    if (!existing) throw new TaskNotFoundError('Task not found')

    // Base scalar update. Undefined = leave unchanged, null = clear.
    const data: Prisma.TaskUpdateInput = {}
    if (input.title !== undefined) data.title = input.title
    if (input.description !== undefined) data.description = input.description
    if (input.priority !== undefined) data.priority = input.priority
    if (input.startDate !== undefined) data.startDate = input.startDate
    if (input.dueDate !== undefined) data.dueDate = input.dueDate
    if (input.estimatedHours !== undefined) {
      data.estimatedHours = input.estimatedHours
    }
    if (input.actualHours !== undefined) data.actualHours = input.actualHours
    if (input.orderIndex !== undefined) data.orderIndex = input.orderIndex

    if (input.statusId !== undefined) {
      data.status = { connect: { id: input.statusId } }
      // Column change → drop at end of the new column. Keeps the old
      // orderIndex in the old column irrelevant (no other row occupies
      // it after this write).
      if (input.statusId !== existing.statusId) {
        data.orderIndex = await nextOrderIndex(companyId, input.statusId)
      }
    }
    if (input.categoryId !== undefined) {
      data.category = input.categoryId
        ? { connect: { id: input.categoryId } }
        : { disconnect: true }
    }
    if (input.parentTaskId !== undefined) {
      data.parentTask = input.parentTaskId
        ? { connect: { id: input.parentTaskId } }
        : { disconnect: true }
    }

    // Membership sets — the caller sends the full desired set; we
    // diff against the current set inside a transaction so partial
    // failure doesn't leave orphan links.
    await prisma.$transaction(async (tx) => {
      await tx.task.update({ where: { id }, data })

      if (input.assigneeIds !== undefined) {
        await tx.taskAssignee.deleteMany({ where: { taskId: id } })
        if (input.assigneeIds.length) {
          await tx.taskAssignee.createMany({
            data: input.assigneeIds.map((userId) => ({
              taskId: id,
              userId,
              companyId,
            })),
          })
        }
      }
      if (input.watcherIds !== undefined) {
        await tx.taskWatcher.deleteMany({ where: { taskId: id } })
        if (input.watcherIds.length) {
          await tx.taskWatcher.createMany({
            data: input.watcherIds.map((userId) => ({
              taskId: id,
              userId,
              companyId,
            })),
          })
        }
      }
      if (input.labelIds !== undefined) {
        await tx.taskLabelLink.deleteMany({ where: { taskId: id } })
        if (input.labelIds.length) {
          await tx.taskLabelLink.createMany({
            data: input.labelIds.map((labelId) => ({
              taskId: id,
              labelId,
              companyId,
            })),
          })
        }
      }

      // Activity log — one row per changed facet. Inside the tx so
      // the log commits atomically with the mutation. Membership
      // changes log the id sets; scalar changes log from/to values.
      if (input.statusId !== undefined) {
        await logDiffIfChanged({
          taskId: id,
          actorId,
          action: 'status_changed',
          from: existing.statusId,
          to: input.statusId,
          tx,
        })
      }
      if (input.priority !== undefined) {
        await logDiffIfChanged({
          taskId: id,
          actorId,
          action: 'priority_changed',
          from: existing.priority,
          to: input.priority,
          tx,
        })
      }
      if (input.categoryId !== undefined) {
        await logDiffIfChanged({
          taskId: id,
          actorId,
          action: 'category_changed',
          from: existing.categoryId,
          to: input.categoryId,
          tx,
        })
      }
      if (input.dueDate !== undefined) {
        await logDiffIfChanged({
          taskId: id,
          actorId,
          action: 'due_date_changed',
          from: existing.dueDate,
          to: input.dueDate,
          tx,
        })
      }
      if (input.assigneeIds !== undefined) {
        await logDiffIfChanged({
          taskId: id,
          actorId,
          action: 'assigned',
          from: existing.assignees.map((a) => a.userId).sort(),
          to: [...input.assigneeIds].sort(),
          tx,
        })
      }
      if (input.watcherIds !== undefined) {
        await logDiffIfChanged({
          taskId: id,
          actorId,
          action: 'watcher_added',
          from: existing.watchers.map((w) => w.userId).sort(),
          to: [...input.watcherIds].sort(),
          tx,
        })
      }
      if (input.labelIds !== undefined) {
        await logDiffIfChanged({
          taskId: id,
          actorId,
          action: 'labels_changed',
          from: existing.labels.map((l) => l.labelId).sort(),
          to: [...input.labelIds].sort(),
          tx,
        })
      }
    })

    return this.get(id)
  }

  /** Soft-archive: hides from default list but stays intact. */
  async archive(id: string, actorId: string | null): Promise<TaskDetail> {
    const existing = await prisma.task.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    })
    if (!existing) throw new TaskNotFoundError('Task not found')
    await prisma.task.update({
      where: { id },
      data: { archivedAt: new Date() },
    })
    await taskActivityService.logEvent({
      taskId: id,
      actorId,
      action: 'archived',
    })
    return this.get(id)
  }

  async restore(id: string, actorId: string | null): Promise<TaskDetail> {
    const existing = await prisma.task.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    })
    if (!existing) throw new TaskNotFoundError('Task not found')
    await prisma.task.update({
      where: { id },
      data: { archivedAt: null },
    })
    await taskActivityService.logEvent({
      taskId: id,
      actorId,
      action: 'restored',
    })
    return this.get(id)
  }

  /** Hard delete via soft-delete column. Cascade wipes children in
   *  the reachable graph, but the row itself stays behind for
   *  potential recovery. Callers wanting a real delete can call
   *  `hardDelete` (super-admin only). */
  async softDelete(id: string, actorId: string | null): Promise<void> {
    const existing = await prisma.task.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    })
    if (!existing) throw new TaskNotFoundError('Task not found')
    await prisma.task.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
    await taskActivityService.logEvent({
      taskId: id,
      actorId,
      action: 'deleted',
    })
  }

  async hardDelete(id: string): Promise<void> {
    await prisma.task.delete({ where: { id } })
  }

  /**
   * Clone a task's core fields + label / assignee / watcher sets.
   * Comments, checklists, attachments, and subtasks are NOT copied —
   * we're duplicating the "template", not the history.
   */
  async duplicate(id: string, reporterId: string | null): Promise<TaskDetail> {
    const companyId = await requireCompanyId()
    const src = await prisma.task.findFirst({
      where: { id, deletedAt: null },
      include: {
        assignees: { select: { userId: true } },
        watchers: { select: { userId: true } },
        labels: { select: { labelId: true } },
      },
    })
    if (!src) throw new TaskNotFoundError('Task not found')

    const orderIndex = await nextOrderIndex(companyId, src.statusId)

    const created = await prisma.task.create({
      data: {
        title: `${src.title} (copy)`,
        description: src.description,
        statusId: src.statusId,
        priority: src.priority,
        categoryId: src.categoryId,
        parentTaskId: src.parentTaskId,
        reporterId,
        startDate: src.startDate,
        dueDate: src.dueDate,
        estimatedHours: src.estimatedHours,
        orderIndex,
        assignees: {
          create: src.assignees.map((a) => ({ userId: a.userId, companyId })),
        },
        watchers: {
          create: src.watchers.map((w) => ({ userId: w.userId, companyId })),
        },
        labels: {
          create: src.labels.map((l) => ({ labelId: l.labelId, companyId })),
        },
      },
      select: { id: true },
    })

    await taskActivityService.logEvent({
      taskId: created.id,
      actorId: reporterId,
      action: 'created',
      toValue: { duplicatedFromId: id, title: `${src.title} (copy)` },
    })

    return this.get(created.id)
  }

  /**
   * Dedicated status transition. Cheap path for drag-drop — updates
   * statusId + orderIndex without touching the rest of the task.
   * Falls back to `nextOrderIndex` when position isn't specified.
   */
  async changeStatus(
    id: string,
    statusId: string,
    actorId: string | null,
    orderIndex?: number,
  ): Promise<TaskDetail> {
    const companyId = await requireCompanyId()
    const existing = await prisma.task.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, statusId: true },
    })
    if (!existing) throw new TaskNotFoundError('Task not found')

    const finalOrderIndex =
      orderIndex ?? (await nextOrderIndex(companyId, statusId))

    await prisma.task.update({
      where: { id },
      data: { statusId, orderIndex: finalOrderIndex },
    })

    await logDiffIfChanged({
      taskId: id,
      actorId,
      action: 'status_changed',
      from: existing.statusId,
      to: statusId,
    })
    return this.get(id)
  }
}

export const taskService = new TaskService()

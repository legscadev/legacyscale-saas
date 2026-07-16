// Immutable audit surface for every mutation on a task. Every write
// path in the tracker calls logEvent() with a short verb tag +
// optional from/to JSON snapshots; the drawer's activity timeline
// (Phase 4) and future automation triggers (Phase 7 notifications)
// read from this table.
//
// Kept as a thin write API plus a paginated read. The renderer sits
// in the UI layer — it switches on `action` to build the sentence
// ("Ruel changed status from To Do to In Progress"), so this file
// stays free of presentation concerns.

import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

/**
 * Canonical verbs. Extend as new mutation shapes land. Keep them
 * short and past-tense — they double as i18n keys in Phase 7.
 */
export type TaskActivityAction =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'priority_changed'
  | 'assigned'
  | 'unassigned'
  | 'watcher_added'
  | 'watcher_removed'
  | 'labels_changed'
  | 'category_changed'
  | 'due_date_changed'
  | 'archived'
  | 'restored'
  | 'deleted'
  | 'comment_added'
  | 'comment_edited'
  | 'comment_deleted'
  | 'checklist_added'
  | 'checklist_deleted'
  | 'checklist_item_added'
  | 'checklist_item_toggled'
  | 'checklist_item_deleted'
  | 'attachment_added'
  | 'attachment_removed'

export interface TaskActivityRow {
  id: string
  taskId: string
  actor: { id: string; name: string | null; email: string } | null
  action: TaskActivityAction
  fromValue: unknown
  toValue: unknown
  createdAt: Date
}

export interface LogEventInput {
  taskId: string
  actorId: string | null
  action: TaskActivityAction
  fromValue?: unknown
  toValue?: unknown
  /**
   * Optional transaction handle. Callers running inside a
   * $transaction can pass tx here so the log write commits atomically
   * with the mutation it describes. When omitted the write uses the
   * base client.
   */
  tx?: Prisma.TransactionClient
}

const ACTIVITY_INCLUDE = {
  actor: { select: { id: true, name: true, email: true } },
} as const satisfies Prisma.TaskActivityLogInclude

type ActivityWithIncludes = Prisma.TaskActivityLogGetPayload<{
  include: typeof ACTIVITY_INCLUDE
}>

function mapRow(row: ActivityWithIncludes): TaskActivityRow {
  return {
    id: row.id,
    taskId: row.taskId,
    actor: row.actor,
    action: row.action as TaskActivityAction,
    // Prisma types Json as JsonValue | null; the UI treats both as
    // unknown JSON to render.
    fromValue: row.fromValue,
    toValue: row.toValue,
    createdAt: row.createdAt,
  }
}

class TaskActivityService {
  /**
   * Write one activity row. Fire-and-forget from the caller's POV —
   * the tenancy extension stamps companyId. Prefer passing `tx` when
   * the surrounding mutation is transactional so the log survives or
   * rolls back atomically.
   */
  async logEvent(input: LogEventInput): Promise<void> {
    const client = input.tx ?? prisma
    await client.taskActivityLog.create({
      data: {
        taskId: input.taskId,
        actorId: input.actorId,
        action: input.action,
        fromValue:
          input.fromValue === undefined
            ? Prisma.JsonNull
            : (input.fromValue as Prisma.InputJsonValue),
        toValue:
          input.toValue === undefined
            ? Prisma.JsonNull
            : (input.toValue as Prisma.InputJsonValue),
      },
    })
  }

  /**
   * Newest-first activity for a single task. Paginated because the
   * timeline can grow unboundedly on long-lived tasks.
   */
  async listForTask(
    taskId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{ items: TaskActivityRow[]; total: number; hasMore: boolean }> {
    const page = options.page ?? 1
    const limit = options.limit ?? 50
    const skip = (page - 1) * limit

    const [rows, total] = await Promise.all([
      prisma.taskActivityLog.findMany({
        where: { taskId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: ACTIVITY_INCLUDE,
      }),
      prisma.taskActivityLog.count({ where: { taskId } }),
    ])

    return {
      items: rows.map(mapRow),
      total,
      hasMore: page * limit < total,
    }
  }
}

export const taskActivityService = new TaskActivityService()

/**
 * Convenience wrapper for the common "compare before/after and log"
 * pattern. Only logs when a diff is present. Nulls / undefined are
 * treated as equal so no-op updates don't spam the timeline.
 */
export async function logDiffIfChanged(args: {
  taskId: string
  actorId: string | null
  action: TaskActivityAction
  from: unknown
  to: unknown
  tx?: Prisma.TransactionClient
}): Promise<void> {
  if (jsonEqual(args.from, args.to)) return
  await taskActivityService.logEvent({
    taskId: args.taskId,
    actorId: args.actorId,
    action: args.action,
    fromValue: args.from,
    toValue: args.to,
    tx: args.tx,
  })
}

/**
 * Structural equality for JSON-serializable values. Fast path handles
 * primitives + arrays + plain objects; dates are compared by ISO
 * string. Not a general-purpose deep-equal — sufficient for the
 * shapes we snapshot into activity rows.
 */
function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return a == null && b == null
  if (a instanceof Date || b instanceof Date) {
    return (
      (a instanceof Date ? a.toISOString() : a) ===
      (b instanceof Date ? b.toISOString() : b)
    )
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((v, i) => jsonEqual(v, b[i]))
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a as object).sort()
    const bk = Object.keys(b as object).sort()
    if (ak.length !== bk.length) return false
    return ak.every(
      (k, i) =>
        k === bk[i] &&
        jsonEqual(
          (a as Record<string, unknown>)[k],
          (b as Record<string, unknown>)[k],
        ),
    )
  }
  return false
}

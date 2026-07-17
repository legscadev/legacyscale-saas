// In-app notifications for the Internal Task Tracker. Every
// meaningful event fans out to the interested recipients — one row
// per (event, recipient) so read state stays per user. The bell
// dropdown in the admin top-bar reads from listForRecipient() with
// a small unread filter; mutation services call notifyX() helpers
// to fire an event without knowing the recipient math.
//
// Recipient rules (kept in one place so the fan-out logic is
// centralized rather than scattered across each mutation site):
//   - assigned:  the newly-assigned user
//   - comment:   every watcher (author excluded)
//   - status:    every watcher (actor excluded)
// Actors never notify themselves — the mutation's own author sees
// their change on the drawer without a bell ping.

import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type { Prisma as PrismaTypes } from '@prisma/client'

/** Notification verbs. Kept aligned with TaskActivityAction where
 *  they overlap so the renderer can share the sentence mapping. */
export type TaskNotificationKind =
  | 'assigned'
  | 'unassigned'
  | 'comment_added'
  | 'status_changed'
  | 'watcher_added'

const NOTIFICATION_INCLUDE = {
  actor: { select: { id: true, name: true, email: true } },
  task: { select: { id: true, title: true } },
} as const satisfies Prisma.TaskNotificationInclude

type NotificationWithIncludes = Prisma.TaskNotificationGetPayload<{
  include: typeof NOTIFICATION_INCLUDE
}>

export interface TaskNotificationRow {
  id: string
  taskId: string
  taskTitle: string
  kind: TaskNotificationKind
  payload: unknown
  actor: { id: string; name: string | null; email: string } | null
  readAt: Date | null
  createdAt: Date
}

function mapRow(row: NotificationWithIncludes): TaskNotificationRow {
  return {
    id: row.id,
    taskId: row.taskId,
    taskTitle: row.task.title,
    kind: row.kind as TaskNotificationKind,
    payload: row.payload,
    actor: row.actor,
    readAt: row.readAt,
    createdAt: row.createdAt,
  }
}

interface FanoutInput {
  taskId: string
  actorId: string | null
  kind: TaskNotificationKind
  recipients: string[]
  payload?: unknown
  tx?: PrismaTypes.TransactionClient
}

/**
 * Write one row per recipient. Filters out the actor so operators
 * don't ping themselves. No-op when the recipient list is empty
 * after filtering.
 */
async function fanout(input: FanoutInput): Promise<void> {
  const client = input.tx ?? prisma
  const targets = Array.from(
    new Set(input.recipients.filter((id) => id !== input.actorId)),
  )
  if (targets.length === 0) return

  // Look up the tenant via the task rather than trusting the caller
  // to pass companyId — keeps the fanout API narrow + prevents
  // notifications from crossing tenants if a mutation service is
  // ever called from an unscoped context.
  const task = await client.task.findFirst({
    where: { id: input.taskId },
    select: { companyId: true },
  })
  if (!task) return

  await client.taskNotification.createMany({
    data: targets.map((recipientId) => ({
      taskId: input.taskId,
      recipientId,
      actorId: input.actorId,
      kind: input.kind,
      payload:
        input.payload === undefined
          ? Prisma.JsonNull
          : (input.payload as PrismaTypes.InputJsonValue),
      companyId: task.companyId,
    })),
  })
}

class TaskNotificationService {
  /** Newest-first list for a recipient. `unreadOnly` powers the
   *  bell badge; leaving it false gives the "See all" tab. */
  async listForRecipient(
    recipientId: string,
    opts: { unreadOnly?: boolean; limit?: number } = {},
  ): Promise<TaskNotificationRow[]> {
    const rows = await prisma.taskNotification.findMany({
      where: {
        recipientId,
        ...(opts.unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: opts.limit ?? 25,
      include: NOTIFICATION_INCLUDE,
    })
    return rows.map(mapRow)
  }

  async countUnread(recipientId: string): Promise<number> {
    return prisma.taskNotification.count({
      where: { recipientId, readAt: null },
    })
  }

  async markRead(recipientId: string, ids: string[]): Promise<number> {
    if (ids.length === 0) return 0
    const res = await prisma.taskNotification.updateMany({
      where: { recipientId, id: { in: ids }, readAt: null },
      data: { readAt: new Date() },
    })
    return res.count
  }

  async markAllRead(recipientId: string): Promise<number> {
    const res = await prisma.taskNotification.updateMany({
      where: { recipientId, readAt: null },
      data: { readAt: new Date() },
    })
    return res.count
  }

  // -------- FANOUT HELPERS (called from mutation services) --------

  /** Notify a user that a task was assigned to them. */
  async notifyAssigned(args: {
    taskId: string
    actorId: string | null
    assigneeIds: string[]
    tx?: PrismaTypes.TransactionClient
  }): Promise<void> {
    await fanout({
      taskId: args.taskId,
      actorId: args.actorId,
      kind: 'assigned',
      recipients: args.assigneeIds,
      tx: args.tx,
    })
  }

  /** Notify every watcher that a comment was added. */
  async notifyCommentAdded(args: {
    taskId: string
    actorId: string | null
    watcherIds: string[]
    commentId: string
    excerpt: string
    tx?: PrismaTypes.TransactionClient
  }): Promise<void> {
    await fanout({
      taskId: args.taskId,
      actorId: args.actorId,
      kind: 'comment_added',
      recipients: args.watcherIds,
      payload: { commentId: args.commentId, excerpt: args.excerpt },
      tx: args.tx,
    })
  }

  /** Notify every watcher that a task's status moved. */
  async notifyStatusChanged(args: {
    taskId: string
    actorId: string | null
    watcherIds: string[]
    fromStatusId: string | null
    toStatusId: string
    tx?: PrismaTypes.TransactionClient
  }): Promise<void> {
    await fanout({
      taskId: args.taskId,
      actorId: args.actorId,
      kind: 'status_changed',
      recipients: args.watcherIds,
      payload: { fromStatusId: args.fromStatusId, toStatusId: args.toStatusId },
      tx: args.tx,
    })
  }
}

export const taskNotificationService = new TaskNotificationService()

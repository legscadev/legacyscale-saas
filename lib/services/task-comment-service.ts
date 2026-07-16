// Comments on tasks. Small surface — add, edit (author-only), delete
// (author + admin), list — deliberately kept out of the main
// task-service.ts so per-file lines stay reasonable.
//
// Mentions: when the caller passes `mentions` (array of userIds), the
// service auto-adds those users as watchers on the task. Notifications
// wiring lives in Phase 7; the watcher upsert here is what powers it.

import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { taskActivityService } from '@/lib/services/task-activity-service'
import { getRequestCompanyId } from '@/lib/tenancy/request-company'
import type {
  AddCommentInput,
  EditCommentInput,
} from '@/lib/validations/tasks'

export class CommentNotFoundError extends Error {
  constructor(message = 'Comment not found') {
    super(message)
    this.name = 'CommentNotFoundError'
  }
}

export class CommentForbiddenError extends Error {
  constructor(message = 'Not allowed to modify this comment') {
    super(message)
    this.name = 'CommentForbiddenError'
  }
}

export interface TaskCommentRow {
  id: string
  taskId: string
  body: string
  author: {
    id: string
    name: string | null
    email: string
  } | null
  editedAt: Date | null
  editedBy: { id: string; name: string | null } | null
  createdAt: Date
}

const COMMENT_INCLUDE = {
  author: { select: { id: true, name: true, email: true } },
  editedBy: { select: { id: true, name: true } },
} as const satisfies Prisma.TaskCommentInclude

type CommentWithIncludes = Prisma.TaskCommentGetPayload<{
  include: typeof COMMENT_INCLUDE
}>

function mapRow(c: CommentWithIncludes): TaskCommentRow {
  return {
    id: c.id,
    taskId: c.taskId,
    body: c.body,
    author: c.author,
    editedAt: c.editedAt,
    editedBy: c.editedBy,
    createdAt: c.createdAt,
  }
}

async function requireCompanyId(): Promise<string> {
  const id = await getRequestCompanyId()
  if (!id) throw new Error('task-comment-service: no active company')
  return id
}

class TaskCommentService {
  /** All comments on a task, oldest-first (chat-style). */
  async list(taskId: string): Promise<TaskCommentRow[]> {
    const rows = await prisma.taskComment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
      include: COMMENT_INCLUDE,
    })
    return rows.map(mapRow)
  }

  async add(
    input: AddCommentInput,
    authorId: string | null,
  ): Promise<TaskCommentRow> {
    const companyId = await requireCompanyId()
    const mentions = input.mentions ?? []

    // Mentioned users become watchers so they're notified on future
    // updates. Author is also a watcher — matches the create-task
    // behavior in task-service.
    const watcherSet = new Set<string>(mentions)
    if (authorId) watcherSet.add(authorId)

    const created = await prisma.$transaction(async (tx) => {
      const c = await tx.taskComment.create({
        data: {
          taskId: input.taskId,
          body: input.body,
          authorId,
        },
        include: COMMENT_INCLUDE,
      })

      if (watcherSet.size > 0) {
        // upsert-many via createMany + skipDuplicates — the compound
        // PK (taskId, userId) prevents dup rows.
        await tx.taskWatcher.createMany({
          data: Array.from(watcherSet).map((userId) => ({
            taskId: input.taskId,
            userId,
            companyId,
          })),
          skipDuplicates: true,
        })
      }

      await taskActivityService.logEvent({
        taskId: input.taskId,
        actorId: authorId,
        action: 'comment_added',
        toValue: { commentId: c.id },
        tx,
      })

      return c
    })

    return mapRow(created)
  }

  /**
   * Edit an existing comment. Only the original author may edit their
   * own comment — admins get a separate delete path. Editing sets
   * editedAt + editedBy so history stays visible in the UI.
   */
  async edit(
    input: EditCommentInput,
    editorId: string,
  ): Promise<TaskCommentRow> {
    const existing = await prisma.taskComment.findUnique({
      where: { id: input.commentId },
      select: { id: true, authorId: true, taskId: true },
    })
    if (!existing) throw new CommentNotFoundError()
    if (existing.authorId !== editorId) throw new CommentForbiddenError()

    const updated = await prisma.taskComment.update({
      where: { id: input.commentId },
      data: {
        body: input.body,
        editedAt: new Date(),
        editedById: editorId,
      },
      include: COMMENT_INCLUDE,
    })
    await taskActivityService.logEvent({
      taskId: existing.taskId,
      actorId: editorId,
      action: 'comment_edited',
      toValue: { commentId: input.commentId },
    })
    return mapRow(updated)
  }

  /**
   * Delete a comment. `canDeleteAny` = true unlocks the admin path
   * (any comment); false requires ownership.
   */
  async delete(
    commentId: string,
    actorId: string,
    canDeleteAny: boolean,
  ): Promise<void> {
    const existing = await prisma.taskComment.findUnique({
      where: { id: commentId },
      select: { id: true, authorId: true, taskId: true },
    })
    if (!existing) throw new CommentNotFoundError()
    if (!canDeleteAny && existing.authorId !== actorId) {
      throw new CommentForbiddenError()
    }
    await prisma.taskComment.delete({ where: { id: commentId } })
    await taskActivityService.logEvent({
      taskId: existing.taskId,
      actorId,
      action: 'comment_deleted',
      fromValue: { commentId },
    })
  }
}

export const taskCommentService = new TaskCommentService()

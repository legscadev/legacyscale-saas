// Membership mutations for a task — replace the assignee set, the
// watcher set, or add/remove a single user from either. The full-
// replace paths mirror task-service.update() but land in isolation
// so the UI can wire per-user chips without loading the edit form.

import { prisma } from '@/lib/prisma'
import { getRequestCompanyId } from '@/lib/tenancy/request-company'
import type {
  AssignTaskInput,
  WatchTaskInput,
} from '@/lib/validations/tasks'

async function requireCompanyId(): Promise<string> {
  const id = await getRequestCompanyId()
  if (!id) throw new Error('task-assignment-service: no active company')
  return id
}

class TaskAssignmentService {
  /**
   * Replace the full assignee set. Diff is done in-DB via
   * deleteMany + createMany inside a transaction — simpler than
   * hand-computing the delta.
   */
  async setAssignees(input: AssignTaskInput): Promise<void> {
    const companyId = await requireCompanyId()
    await prisma.$transaction(async (tx) => {
      await tx.taskAssignee.deleteMany({ where: { taskId: input.taskId } })
      if (input.userIds.length > 0) {
        await tx.taskAssignee.createMany({
          data: input.userIds.map((userId) => ({
            taskId: input.taskId,
            userId,
            companyId,
          })),
        })
      }
    })
  }

  async setWatchers(input: WatchTaskInput): Promise<void> {
    const companyId = await requireCompanyId()
    await prisma.$transaction(async (tx) => {
      await tx.taskWatcher.deleteMany({ where: { taskId: input.taskId } })
      if (input.userIds.length > 0) {
        await tx.taskWatcher.createMany({
          data: input.userIds.map((userId) => ({
            taskId: input.taskId,
            userId,
            companyId,
          })),
        })
      }
    })
  }

  /** Add a single user as watcher (self-follow). Idempotent — the
   *  compound PK swallows duplicates when skipDuplicates is on. */
  async watch(taskId: string, userId: string): Promise<void> {
    const companyId = await requireCompanyId()
    await prisma.taskWatcher.createMany({
      data: [{ taskId, userId, companyId }],
      skipDuplicates: true,
    })
  }

  async unwatch(taskId: string, userId: string): Promise<void> {
    await prisma.taskWatcher.deleteMany({
      where: { taskId, userId },
    })
  }

  /** Single-user assignee toggle — used by row-action menus. */
  async assign(taskId: string, userId: string): Promise<void> {
    const companyId = await requireCompanyId()
    await prisma.taskAssignee.createMany({
      data: [{ taskId, userId, companyId }],
      skipDuplicates: true,
    })
  }

  async unassign(taskId: string, userId: string): Promise<void> {
    await prisma.taskAssignee.deleteMany({
      where: { taskId, userId },
    })
  }
}

export const taskAssignmentService = new TaskAssignmentService()

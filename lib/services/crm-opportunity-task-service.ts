// Tasks pinned to a CRM opportunity.
//
// Powers the "Tasks" tab in the edit-opportunity dialog. Each task is
// a to-do owned by an assignee (defaults to the creator) with an
// optional due date. Toggling completed stamps/clears completedAt so
// the card badge can count outstanding work without loading rows.
//
// Tenant scoping is handled by the Prisma tenancy extension; we still
// look up companyId once here to attach on insert (the extension
// insists the write include it explicitly).

import { prisma } from '@/lib/prisma'
import { getRequestCompanyId } from '@/lib/tenancy/request-company'

export class OpportunityTaskNotFoundError extends Error {
  constructor(message = 'Task not found') {
    super(message)
    this.name = 'OpportunityTaskNotFoundError'
  }
}

async function requireCompanyId(): Promise<string> {
  const id = await getRequestCompanyId()
  if (!id) throw new Error('crm-opportunity-task-service: no active company')
  return id
}

/** Shape sent to the client. `assignee` is optional because the
 *  original user may have been deleted (FK is SetNull). */
export interface OpportunityTaskItem {
  id: string
  title: string
  dueDate: Date | null
  completedAt: Date | null
  createdAt: Date
  assignee: { id: string; name: string | null; email: string } | null
  createdBy: { id: string; name: string | null; email: string } | null
}

const USER_SELECT = {
  select: { id: true, name: true, email: true },
} as const

class CrmOpportunityTaskService {
  /** Timeline for one deal — open first (nulls in Postgres sort last
   *  by default with `desc`, so we explicitly ask for open-then-done). */
  async list(opportunityId: string): Promise<OpportunityTaskItem[]> {
    return prisma.crmOpportunityTask.findMany({
      where: { opportunityId },
      orderBy: [{ completedAt: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        dueDate: true,
        completedAt: true,
        createdAt: true,
        assignee: USER_SELECT,
        createdBy: USER_SELECT,
      },
    })
  }

  async create(input: {
    opportunityId: string
    title: string
    dueDate: Date | null
    assigneeId: string | null
    actorId: string | null
  }): Promise<OpportunityTaskItem> {
    const companyId = await requireCompanyId()
    return prisma.crmOpportunityTask.create({
      data: {
        companyId,
        opportunityId: input.opportunityId,
        title: input.title,
        dueDate: input.dueDate,
        assigneeId: input.assigneeId ?? input.actorId,
        createdById: input.actorId,
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        completedAt: true,
        createdAt: true,
        assignee: USER_SELECT,
        createdBy: USER_SELECT,
      },
    })
  }

  async update(input: {
    taskId: string
    title?: string
    dueDate?: Date | null
    assigneeId?: string | null
  }): Promise<OpportunityTaskItem> {
    const existing = await prisma.crmOpportunityTask.findFirst({
      where: { id: input.taskId },
      select: { id: true },
    })
    if (!existing) throw new OpportunityTaskNotFoundError()

    return prisma.crmOpportunityTask.update({
      where: { id: input.taskId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
        ...(input.assigneeId !== undefined
          ? { assigneeId: input.assigneeId }
          : {}),
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        completedAt: true,
        createdAt: true,
        assignee: USER_SELECT,
        createdBy: USER_SELECT,
      },
    })
  }

  async toggle(taskId: string, completed: boolean): Promise<OpportunityTaskItem> {
    const existing = await prisma.crmOpportunityTask.findFirst({
      where: { id: taskId },
      select: { id: true },
    })
    if (!existing) throw new OpportunityTaskNotFoundError()

    return prisma.crmOpportunityTask.update({
      where: { id: taskId },
      data: { completedAt: completed ? new Date() : null },
      select: {
        id: true,
        title: true,
        dueDate: true,
        completedAt: true,
        createdAt: true,
        assignee: USER_SELECT,
        createdBy: USER_SELECT,
      },
    })
  }

  async delete(taskId: string): Promise<void> {
    await prisma.crmOpportunityTask.delete({ where: { id: taskId } })
  }
}

export const crmOpportunityTaskService = new CrmOpportunityTaskService()

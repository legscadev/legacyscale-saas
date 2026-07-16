// Checklists on tasks. A task can hold multiple named checklists
// ("Pre-launch", "Handoff"); each has an ordered list of items with
// a done flag. Kept separate from task-service so both files stay
// under the 300-line target.

import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { getRequestCompanyId } from '@/lib/tenancy/request-company'
import type {
  AddChecklistItemInput,
  CreateChecklistInput,
  RenameChecklistInput,
  ReorderChecklistItemsInput,
  UpdateChecklistItemInput,
} from '@/lib/validations/tasks'

export class ChecklistNotFoundError extends Error {
  constructor(message = 'Checklist not found') {
    super(message)
    this.name = 'ChecklistNotFoundError'
  }
}

export class ChecklistItemNotFoundError extends Error {
  constructor(message = 'Checklist item not found') {
    super(message)
    this.name = 'ChecklistItemNotFoundError'
  }
}

export interface ChecklistItemRow {
  id: string
  text: string
  isDone: boolean
  doneBy: { id: string; name: string | null } | null
  doneAt: Date | null
  orderIndex: number
}

export interface ChecklistRow {
  id: string
  taskId: string
  title: string
  orderIndex: number
  items: ChecklistItemRow[]
}

const CHECKLIST_INCLUDE = {
  items: {
    orderBy: { orderIndex: 'asc' },
    include: {
      doneBy: { select: { id: true, name: true } },
    },
  },
} as const satisfies Prisma.TaskChecklistInclude

type ChecklistWithIncludes = Prisma.TaskChecklistGetPayload<{
  include: typeof CHECKLIST_INCLUDE
}>

function mapRow(c: ChecklistWithIncludes): ChecklistRow {
  return {
    id: c.id,
    taskId: c.taskId,
    title: c.title,
    orderIndex: c.orderIndex,
    items: c.items.map((i) => ({
      id: i.id,
      text: i.text,
      isDone: i.isDone,
      doneBy: i.doneBy,
      doneAt: i.doneAt,
      orderIndex: i.orderIndex,
    })),
  }
}

async function requireCompanyId(): Promise<string> {
  const id = await getRequestCompanyId()
  if (!id) throw new Error('task-checklist-service: no active company')
  return id
}

class TaskChecklistService {
  /** All checklists on a task, in display order. */
  async listForTask(taskId: string): Promise<ChecklistRow[]> {
    const rows = await prisma.taskChecklist.findMany({
      where: { taskId },
      orderBy: { orderIndex: 'asc' },
      include: CHECKLIST_INCLUDE,
    })
    return rows.map(mapRow)
  }

  async createChecklist(input: CreateChecklistInput): Promise<ChecklistRow> {
    // Order at the end of the task's existing checklists.
    const last = await prisma.taskChecklist.findFirst({
      where: { taskId: input.taskId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    })
    const orderIndex = (last?.orderIndex ?? -1) + 1

    const created = await prisma.taskChecklist.create({
      data: {
        taskId: input.taskId,
        title: input.title,
        orderIndex,
      },
      include: CHECKLIST_INCLUDE,
    })
    return mapRow(created)
  }

  async renameChecklist(input: RenameChecklistInput): Promise<ChecklistRow> {
    const existing = await prisma.taskChecklist.findUnique({
      where: { id: input.checklistId },
      select: { id: true },
    })
    if (!existing) throw new ChecklistNotFoundError()

    const updated = await prisma.taskChecklist.update({
      where: { id: input.checklistId },
      data: { title: input.title },
      include: CHECKLIST_INCLUDE,
    })
    return mapRow(updated)
  }

  async deleteChecklist(checklistId: string): Promise<void> {
    const existing = await prisma.taskChecklist.findUnique({
      where: { id: checklistId },
      select: { id: true },
    })
    if (!existing) throw new ChecklistNotFoundError()
    await prisma.taskChecklist.delete({ where: { id: checklistId } })
  }

  async addItem(input: AddChecklistItemInput): Promise<ChecklistItemRow> {
    const companyId = await requireCompanyId()
    const parent = await prisma.taskChecklist.findUnique({
      where: { id: input.checklistId },
      select: { id: true },
    })
    if (!parent) throw new ChecklistNotFoundError()

    const last = await prisma.taskChecklistItem.findFirst({
      where: { checklistId: input.checklistId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    })
    const orderIndex = (last?.orderIndex ?? -1) + 1

    const created = await prisma.taskChecklistItem.create({
      data: {
        checklistId: input.checklistId,
        text: input.text,
        orderIndex,
        // Nested create wouldn't be auto-stamped here (this is a
        // top-level call), but Prisma extension will handle it —
        // keeping companyId explicit for consistency with peer
        // services that batch-create.
        companyId,
      },
      include: { doneBy: { select: { id: true, name: true } } },
    })
    return {
      id: created.id,
      text: created.text,
      isDone: created.isDone,
      doneBy: created.doneBy,
      doneAt: created.doneAt,
      orderIndex: created.orderIndex,
    }
  }

  /**
   * Toggle isDone or rename a single item. When flipping to done, we
   * stamp doneBy + doneAt; flipping back clears both.
   */
  async updateItem(
    input: UpdateChecklistItemInput,
    actorId: string | null,
  ): Promise<ChecklistItemRow> {
    const existing = await prisma.taskChecklistItem.findUnique({
      where: { id: input.itemId },
      select: { id: true, isDone: true },
    })
    if (!existing) throw new ChecklistItemNotFoundError()

    const data: Prisma.TaskChecklistItemUpdateInput = {}
    if (input.text !== undefined) data.text = input.text
    if (input.isDone !== undefined) {
      data.isDone = input.isDone
      if (input.isDone) {
        data.doneAt = new Date()
        if (actorId) data.doneBy = { connect: { id: actorId } }
      } else {
        data.doneAt = null
        data.doneBy = { disconnect: true }
      }
    }

    const updated = await prisma.taskChecklistItem.update({
      where: { id: input.itemId },
      data,
      include: { doneBy: { select: { id: true, name: true } } },
    })
    return {
      id: updated.id,
      text: updated.text,
      isDone: updated.isDone,
      doneBy: updated.doneBy,
      doneAt: updated.doneAt,
      orderIndex: updated.orderIndex,
    }
  }

  async deleteItem(itemId: string): Promise<void> {
    const existing = await prisma.taskChecklistItem.findUnique({
      where: { id: itemId },
      select: { id: true },
    })
    if (!existing) throw new ChecklistItemNotFoundError()
    await prisma.taskChecklistItem.delete({ where: { id: itemId } })
  }

  /**
   * Reorder items within a checklist. Caller sends the desired order
   * as an array of item ids; we rewrite orderIndex 0..N in a
   * transaction so partial failure leaves ordering consistent.
   */
  async reorderItems(input: ReorderChecklistItemsInput): Promise<ChecklistRow> {
    const parent = await prisma.taskChecklist.findUnique({
      where: { id: input.checklistId },
      select: { id: true },
    })
    if (!parent) throw new ChecklistNotFoundError()

    await prisma.$transaction(
      input.itemIds.map((id, index) =>
        prisma.taskChecklistItem.update({
          where: { id },
          data: { orderIndex: index },
        }),
      ),
    )

    const updated = await prisma.taskChecklist.findUnique({
      where: { id: input.checklistId },
      include: CHECKLIST_INCLUDE,
    })
    if (!updated) throw new ChecklistNotFoundError()
    return mapRow(updated)
  }
}

export const taskChecklistService = new TaskChecklistService()

import { prisma } from '@/lib/prisma'

export interface ChecklistItem {
  id: string
  label: string
  description: string | null
  orderIndex: number
  /** How many EmployeeChecklistItemStatus rows reference this item. */
  statusCount: number
}

export interface AddChecklistItemInput {
  label: string
  description?: string | null
}

export interface UpdateChecklistItemInput {
  label?: string
  description?: string | null
}

/**
 * Impact preview for deleting a checklist item. The UI shows this
 * before asking for confirmation so admins know what history
 * they're about to burn — status rows cascade-delete with the item.
 */
export interface DeleteItemImpact {
  itemLabel: string
  statusCount: number
  affectedEmployeeCount: number
}

class ChecklistService {
  /** Return every item in display order, with per-item status counts. */
  async listItems(): Promise<ChecklistItem[]> {
    const rows = await prisma.onboardingChecklistItem.findMany({
      orderBy: { orderIndex: 'asc' },
      include: { _count: { select: { statuses: true } } },
    })
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      description: r.description,
      orderIndex: r.orderIndex,
      statusCount: r._count.statuses,
    }))
  }

  async addItem(input: AddChecklistItemInput): Promise<ChecklistItem[]> {
    const last = await prisma.onboardingChecklistItem.findFirst({
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    })
    const nextIndex = (last?.orderIndex ?? -1) + 1
    await prisma.onboardingChecklistItem.create({
      data: {
        label: input.label,
        description: input.description ?? null,
        orderIndex: nextIndex,
      },
    })
    return this.listItems()
  }

  async updateItem(
    itemId: string,
    input: UpdateChecklistItemInput,
  ): Promise<ChecklistItem[]> {
    const item = await prisma.onboardingChecklistItem.findUnique({
      where: { id: itemId },
      select: { id: true },
    })
    if (!item) throw new Error('Checklist item not found')
    await prisma.onboardingChecklistItem.update({
      where: { id: itemId },
      data: {
        ...(input.label !== undefined && { label: input.label }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
      },
    })
    return this.listItems()
  }

  /**
   * Move an item to a new zero-based index. All neighbouring items
   * shift by one to keep the sequence dense. Uses the two-pass
   * negative-space swap so the `@@unique` on orderIndex doesn't
   * collide mid-transaction.
   */
  async moveItem(
    itemId: string,
    targetIndex: number,
  ): Promise<ChecklistItem[]> {
    const target = await prisma.onboardingChecklistItem.findUnique({
      where: { id: itemId },
      select: { id: true, orderIndex: true },
    })
    if (!target) throw new Error('Checklist item not found')

    const items = await prisma.onboardingChecklistItem.findMany({
      orderBy: { orderIndex: 'asc' },
      select: { id: true },
    })
    const from = items.findIndex((i) => i.id === itemId)
    if (from < 0) throw new Error('Checklist item not found in the list')

    const clamped = Math.max(0, Math.min(items.length - 1, targetIndex))
    if (from === clamped) return this.listItems()

    const reordered = [...items]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(clamped, 0, moved!)

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < reordered.length; i++) {
        await tx.onboardingChecklistItem.update({
          where: { id: reordered[i]!.id },
          data: { orderIndex: -(i + 1) },
        })
      }
      for (let i = 0; i < reordered.length; i++) {
        await tx.onboardingChecklistItem.update({
          where: { id: reordered[i]!.id },
          data: { orderIndex: i },
        })
      }
    })
    return this.listItems()
  }

  async deleteItemImpact(itemId: string): Promise<DeleteItemImpact> {
    const item = await prisma.onboardingChecklistItem.findUnique({
      where: { id: itemId },
      select: {
        label: true,
        _count: { select: { statuses: true } },
        statuses: { select: { employeeId: true }, distinct: ['employeeId'] },
      },
    })
    if (!item) throw new Error('Checklist item not found')
    return {
      itemLabel: item.label,
      statusCount: item._count.statuses,
      affectedEmployeeCount: item.statuses.length,
    }
  }

  async deleteItem(itemId: string): Promise<ChecklistItem[]> {
    const item = await prisma.onboardingChecklistItem.findUnique({
      where: { id: itemId },
      select: { id: true },
    })
    if (!item) throw new Error('Checklist item not found')
    // Cascade: employee_checklist_item_statuses rows for this item
    // are removed by the FK on delete.
    await prisma.onboardingChecklistItem.delete({ where: { id: itemId } })
    return this.listItems()
  }
}

export const checklistService = new ChecklistService()

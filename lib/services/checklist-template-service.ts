import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

export interface TemplateListItem {
  id: string
  slug: string
  name: string
  description: string | null
  isDefault: boolean
  itemCount: number
  employeeCount: number
  createdAt: Date
  updatedAt: Date
}

export interface TemplateDetail {
  id: string
  slug: string
  name: string
  description: string | null
  isDefault: boolean
  employeeCount: number
  items: Array<{
    id: string
    label: string
    description: string | null
    orderIndex: number
    statusCount: number
  }>
}

export interface CreateTemplateInput {
  name: string
  description?: string | null
  isDefault?: boolean
}

export interface UpdateTemplateInput {
  name?: string
  description?: string | null
  isDefault?: boolean
}

export interface AddTemplateItemInput {
  label: string
  description?: string | null
}

export interface UpdateTemplateItemInput {
  label?: string
  description?: string | null
}

/**
 * Impact preview for deleting a checklist item. The UI shows this
 * *before* asking for confirmation so admins know what history
 * they're about to burn — status rows cascade-delete with the item.
 */
export interface DeleteItemImpact {
  itemLabel: string
  statusCount: number
  affectedEmployeeCount: number
}

/**
 * Turns a user-supplied name into a stable, lowercase, hyphen-cased
 * slug. Not fool-proof — collisions get suffixed with `-2`, `-3`, ...
 * until unique.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'template'
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let candidate = base
  let n = 2
  while (true) {
    const clash = await prisma.onboardingChecklistTemplate.findFirst({
      where: { slug: candidate, ...(excludeId && { NOT: { id: excludeId } }) },
      select: { id: true },
    })
    if (!clash) return candidate
    candidate = `${base}-${n++}`
  }
}

class ChecklistTemplateService {
  async list(): Promise<TemplateListItem[]> {
    const rows = await prisma.onboardingChecklistTemplate.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: {
        _count: { select: { items: true, employees: true } },
      },
    })
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      isDefault: r.isDefault,
      itemCount: r._count.items,
      employeeCount: r._count.employees,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
  }

  async get(id: string): Promise<TemplateDetail> {
    const template = await prisma.onboardingChecklistTemplate.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { orderIndex: 'asc' },
          include: { _count: { select: { statuses: true } } },
        },
        _count: { select: { employees: true } },
      },
    })
    if (!template) throw new Error('Template not found')
    return {
      id: template.id,
      slug: template.slug,
      name: template.name,
      description: template.description,
      isDefault: template.isDefault,
      employeeCount: template._count.employees,
      items: template.items.map((i) => ({
        id: i.id,
        label: i.label,
        description: i.description,
        orderIndex: i.orderIndex,
        statusCount: i._count.statuses,
      })),
    }
  }

  async create(input: CreateTemplateInput): Promise<TemplateDetail> {
    const slug = await uniqueSlug(slugify(input.name))
    const template = await prisma.$transaction(async (tx) => {
      // Only one default template — flip everyone else off first.
      if (input.isDefault) {
        await tx.onboardingChecklistTemplate.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        })
      }
      return tx.onboardingChecklistTemplate.create({
        data: {
          slug,
          name: input.name,
          description: input.description ?? null,
          isDefault: input.isDefault ?? false,
        },
      })
    })
    return this.get(template.id)
  }

  async update(id: string, input: UpdateTemplateInput): Promise<TemplateDetail> {
    await this.get(id) // throws if not found
    await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.onboardingChecklistTemplate.updateMany({
          where: { isDefault: true, NOT: { id } },
          data: { isDefault: false },
        })
      }
      const data: Prisma.OnboardingChecklistTemplateUpdateInput = {}
      if (input.name !== undefined) {
        data.name = input.name
        data.slug = await uniqueSlug(slugify(input.name), id)
      }
      if (input.description !== undefined) data.description = input.description
      if (input.isDefault !== undefined) data.isDefault = input.isDefault
      await tx.onboardingChecklistTemplate.update({ where: { id }, data })
    })
    return this.get(id)
  }

  async delete(id: string): Promise<void> {
    await this.get(id)
    // FK on employees.template_id is SetNull — deletion just detaches
    // any employees currently using this template. Items cascade.
    await prisma.onboardingChecklistTemplate.delete({ where: { id } })
  }

  async addItem(
    templateId: string,
    input: AddTemplateItemInput,
  ): Promise<TemplateDetail> {
    await this.get(templateId)
    const last = await prisma.onboardingChecklistItem.findFirst({
      where: { templateId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    })
    const nextIndex = (last?.orderIndex ?? -1) + 1
    await prisma.onboardingChecklistItem.create({
      data: {
        templateId,
        label: input.label,
        description: input.description ?? null,
        orderIndex: nextIndex,
      },
    })
    return this.get(templateId)
  }

  async updateItem(
    itemId: string,
    input: UpdateTemplateItemInput,
  ): Promise<TemplateDetail> {
    const item = await prisma.onboardingChecklistItem.findUnique({
      where: { id: itemId },
      select: { id: true, templateId: true },
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
    return this.get(item.templateId)
  }

  /**
   * Move an item to a new zero-based index within its template. All
   * neighbouring items shift by one to keep the sequence dense.
   * Because `(templateId, orderIndex)` is unique, we bump every item
   * into negative space in a first pass, then apply the final
   * positive indices — this sidesteps the temporary collisions that
   * a naïve swap would trigger.
   */
  async moveItem(itemId: string, targetIndex: number): Promise<TemplateDetail> {
    const target = await prisma.onboardingChecklistItem.findUnique({
      where: { id: itemId },
      select: { id: true, templateId: true, orderIndex: true },
    })
    if (!target) throw new Error('Checklist item not found')

    const items = await prisma.onboardingChecklistItem.findMany({
      where: { templateId: target.templateId },
      orderBy: { orderIndex: 'asc' },
      select: { id: true },
    })
    const from = items.findIndex((i) => i.id === itemId)
    if (from < 0) throw new Error('Checklist item not found in its template')

    const clamped = Math.max(0, Math.min(items.length - 1, targetIndex))
    if (from === clamped) return this.get(target.templateId)

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
    return this.get(target.templateId)
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

  async deleteItem(itemId: string): Promise<TemplateDetail> {
    const item = await prisma.onboardingChecklistItem.findUnique({
      where: { id: itemId },
      select: { id: true, templateId: true },
    })
    if (!item) throw new Error('Checklist item not found')
    // Cascade: employee_checklist_item_statuses rows for this item
    // are removed by the FK on delete.
    await prisma.onboardingChecklistItem.delete({ where: { id: itemId } })
    return this.get(item.templateId)
  }
}

export const checklistTemplateService = new ChecklistTemplateService()

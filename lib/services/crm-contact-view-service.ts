// CRUD for the CrmContactView "smart list" model. Views are
// private per owner in P0 — every method scopes to the caller's
// user id. Filter payload is stored/returned as JSON exactly as
// the client saved it; the shape is validated in the action layer
// via contactViewFilterSchema.

import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

export class ContactViewNotFoundError extends Error {
  constructor(message = 'Smart list not found') {
    super(message)
    this.name = 'ContactViewNotFoundError'
  }
}

export interface ContactViewRow {
  id: string
  name: string
  filter: Prisma.JsonValue
  orderIndex: number
  updatedAt: Date
}

class CrmContactViewService {
  /** Every view owned by `ownerId`, ordered for stable tab layout. */
  async list(ownerId: string): Promise<ContactViewRow[]> {
    const rows = await prisma.crmContactView.findMany({
      where: { ownerId },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        filterJson: true,
        orderIndex: true,
        updatedAt: true,
      },
    })
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      filter: r.filterJson,
      orderIndex: r.orderIndex,
      updatedAt: r.updatedAt,
    }))
  }

  async create(input: {
    name: string
    filter: Prisma.InputJsonValue
    ownerId: string
  }): Promise<ContactViewRow> {
    const last = await prisma.crmContactView.findFirst({
      where: { ownerId: input.ownerId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    })
    const created = await prisma.crmContactView.create({
      data: {
        name: input.name,
        filterJson: input.filter,
        ownerId: input.ownerId,
        orderIndex: (last?.orderIndex ?? -1) + 1,
      },
      select: {
        id: true,
        name: true,
        filterJson: true,
        orderIndex: true,
        updatedAt: true,
      },
    })
    return {
      id: created.id,
      name: created.name,
      filter: created.filterJson,
      orderIndex: created.orderIndex,
      updatedAt: created.updatedAt,
    }
  }

  async rename(input: {
    viewId: string
    name: string
    ownerId: string
  }): Promise<void> {
    const existing = await this.assertOwned(input.viewId, input.ownerId)
    await prisma.crmContactView.update({
      where: { id: existing.id },
      data: { name: input.name },
    })
  }

  async updateFilter(input: {
    viewId: string
    filter: Prisma.InputJsonValue
    ownerId: string
  }): Promise<void> {
    const existing = await this.assertOwned(input.viewId, input.ownerId)
    await prisma.crmContactView.update({
      where: { id: existing.id },
      data: { filterJson: input.filter },
    })
  }

  async delete(input: { viewId: string; ownerId: string }): Promise<void> {
    const existing = await this.assertOwned(input.viewId, input.ownerId)
    await prisma.crmContactView.delete({ where: { id: existing.id } })
  }

  private async assertOwned(
    viewId: string,
    ownerId: string,
  ): Promise<{ id: string }> {
    const row = await prisma.crmContactView.findFirst({
      where: { id: viewId, ownerId },
      select: { id: true },
    })
    if (!row) throw new ContactViewNotFoundError()
    return row
  }
}

export const crmContactViewService = new CrmContactViewService()

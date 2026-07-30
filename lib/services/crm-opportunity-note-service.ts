// Note timeline for a CRM opportunity.
//
// Powers the "Notes" tab in the edit-opportunity dialog. Distinct
// from the free-text CrmOpportunity.notes field (kept for CSV
// imports) — this table stores per-entry timeline history with
// author + timestamp.

import { prisma } from '@/lib/prisma'
import { getRequestCompanyId } from '@/lib/tenancy/request-company'

export class OpportunityNoteNotFoundError extends Error {
  constructor(message = 'Note not found') {
    super(message)
    this.name = 'OpportunityNoteNotFoundError'
  }
}

async function requireCompanyId(): Promise<string> {
  const id = await getRequestCompanyId()
  if (!id) throw new Error('crm-opportunity-note-service: no active company')
  return id
}

export interface OpportunityNoteItem {
  id: string
  body: string
  createdAt: Date
  updatedAt: Date
  author: { id: string; name: string | null; email: string } | null
}

const USER_SELECT = {
  select: { id: true, name: true, email: true },
} as const

class CrmOpportunityNoteService {
  /** Newest-first, matching GHL's timeline order. */
  async list(opportunityId: string): Promise<OpportunityNoteItem[]> {
    return prisma.crmOpportunityNote.findMany({
      where: { opportunityId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        body: true,
        createdAt: true,
        updatedAt: true,
        author: USER_SELECT,
      },
    })
  }

  async create(input: {
    opportunityId: string
    body: string
    actorId: string | null
  }): Promise<OpportunityNoteItem> {
    const companyId = await requireCompanyId()
    return prisma.crmOpportunityNote.create({
      data: {
        companyId,
        opportunityId: input.opportunityId,
        body: input.body,
        authorId: input.actorId,
      },
      select: {
        id: true,
        body: true,
        createdAt: true,
        updatedAt: true,
        author: USER_SELECT,
      },
    })
  }

  async update(input: {
    noteId: string
    body: string
  }): Promise<OpportunityNoteItem> {
    const existing = await prisma.crmOpportunityNote.findFirst({
      where: { id: input.noteId },
      select: { id: true },
    })
    if (!existing) throw new OpportunityNoteNotFoundError()

    return prisma.crmOpportunityNote.update({
      where: { id: input.noteId },
      data: { body: input.body },
      select: {
        id: true,
        body: true,
        createdAt: true,
        updatedAt: true,
        author: USER_SELECT,
      },
    })
  }

  async delete(noteId: string): Promise<void> {
    await prisma.crmOpportunityNote.delete({ where: { id: noteId } })
  }
}

export const crmOpportunityNoteService = new CrmOpportunityNoteService()

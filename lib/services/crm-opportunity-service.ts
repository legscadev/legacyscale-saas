// Read/write helpers for CRM opportunities (deals on the board).
//
// Mirrors task-service: a board-oriented `list`, a `create` that
// drops a deal into a stage, and `changeStage` (the Kanban drag-drop
// write path) that rewrites stageId + orderIndex and flips the deal's
// OPEN/WON/LOST status when it lands in a terminal column.
//
// Tenant scoping is automatic via the Prisma tenancy extension for
// top-level ops; companyId is resolved once here for the orderIndex
// tail query (which the extension also scopes, but we pass it for the
// index hit + clarity).

import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { getRequestCompanyId } from '@/lib/tenancy/request-company'
import type { OpportunityFilterOutput } from '@/lib/validations/crm'
import type {
  CreateOpportunityOutput,
  UpdateOpportunityOutput,
} from '@/lib/validations/crm'

export class OpportunityNotFoundError extends Error {
  constructor(message = 'Opportunity not found') {
    super(message)
    this.name = 'OpportunityNotFoundError'
  }
}

export class StageNotFoundError extends Error {
  constructor(message = 'Target stage not found') {
    super(message)
    this.name = 'StageNotFoundError'
  }
}

async function requireCompanyId(): Promise<string> {
  const id = await getRequestCompanyId()
  if (!id) throw new Error('crm-opportunity-service: no active company')
  return id
}

/** orderIndex step — keep gaps so single-card moves rarely touch
 *  neighbours. Matches the Kanban board + task-service constant. */
const ORDER_STEP = 100

async function nextOrderIndex(
  companyId: string,
  stageId: string,
): Promise<number> {
  const last = await prisma.crmOpportunity.findFirst({
    where: { companyId, stageId, deletedAt: null },
    orderBy: { orderIndex: 'desc' },
    select: { orderIndex: true },
  })
  return (last?.orderIndex ?? 0) + ORDER_STEP
}

// ============================================
// SHAPES
// ============================================

export interface OpportunityCloser {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
}

/** One card on the board. Kept flat + serializable. */
export interface OpportunityListItem {
  id: string
  name: string
  stageId: string
  orderIndex: number
  status: 'OPEN' | 'WON' | 'LOST'
  value: number | null
  probability: number | null
  contactName: string | null
  companyName: string | null
  expectedCloseDate: Date | null
  assignedCloser: OpportunityCloser | null
  /** True when the deal has non-empty notes — powers the card's
   *  note-indicator icon without shipping the full notes text. */
  hasNotes: boolean
}

const CLOSER_SELECT = {
  select: { id: true, name: true, email: true, avatarUrl: true },
} as const satisfies Prisma.UserDefaultArgs

function toListItem(row: {
  id: string
  name: string
  stageId: string
  orderIndex: number
  status: 'OPEN' | 'WON' | 'LOST'
  value: Prisma.Decimal | null
  probability: number | null
  contactName: string | null
  companyName: string | null
  expectedCloseDate: Date | null
  assignedCloser: OpportunityCloser | null
  notes: string | null
}): OpportunityListItem {
  return {
    id: row.id,
    name: row.name,
    stageId: row.stageId,
    orderIndex: row.orderIndex,
    status: row.status,
    // Decimal → number for the client. Deal values sit well within
    // JS safe-integer range so this is lossless in practice.
    value: row.value === null ? null : Number(row.value),
    probability: row.probability,
    contactName: row.contactName,
    companyName: row.companyName,
    expectedCloseDate: row.expectedCloseDate,
    assignedCloser: row.assignedCloser,
    hasNotes: row.notes !== null && row.notes.trim().length > 0,
  }
}

class CrmOpportunityService {
  /**
   * Board items for one pipeline. Returns every non-deleted deal in
   * the pipeline ordered by (stageId, orderIndex) so the client can
   * bucket them into columns. `assigneeIds` narrows to specific
   * closers (used by the team surface's "only mine" fold); `status`
   * and `search` are optional facets.
   */
  async list(
    pipelineId: string,
    filters: OpportunityFilterOutput,
  ): Promise<OpportunityListItem[]> {
    const where: Prisma.CrmOpportunityWhereInput = {
      pipelineId,
      deletedAt: null,
    }

    if (filters.assigneeIds.length > 0) {
      where.assignedCloserId = { in: filters.assigneeIds }
    }
    if (filters.status) {
      where.status = filters.status
    }
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { contactName: { contains: filters.search, mode: 'insensitive' } },
        { companyName: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    const rows = await prisma.crmOpportunity.findMany({
      where,
      orderBy: [{ stageId: 'asc' }, { orderIndex: 'asc' }],
      select: {
        id: true,
        name: true,
        stageId: true,
        orderIndex: true,
        status: true,
        value: true,
        probability: true,
        contactName: true,
        companyName: true,
        expectedCloseDate: true,
        assignedCloser: CLOSER_SELECT,
        notes: true,
      },
    })
    return rows.map(toListItem)
  }

  /** Full detail for one deal (drawer / edit form). */
  async get(id: string): Promise<OpportunityListItem & {
    contactEmail: string | null
    contactPhone: string | null
    notes: string | null
    pipelineId: string
  }> {
    const row = await prisma.crmOpportunity.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        stageId: true,
        pipelineId: true,
        orderIndex: true,
        status: true,
        value: true,
        probability: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        companyName: true,
        expectedCloseDate: true,
        notes: true,
        assignedCloser: CLOSER_SELECT,
      },
    })
    if (!row) throw new OpportunityNotFoundError()
    return {
      ...toListItem(row),
      contactEmail: row.contactEmail,
      contactPhone: row.contactPhone,
      notes: row.notes,
      pipelineId: row.pipelineId,
    }
  }

  /**
   * Create a deal. `stageId` defaults to the pipeline's first
   * (lowest-orderIndex) stage when omitted, and the deal inherits
   * that stage's default probability unless one was supplied.
   */
  async create(
    pipelineId: string,
    input: CreateOpportunityOutput,
    actorId: string | null,
  ): Promise<OpportunityListItem> {
    const companyId = await requireCompanyId()

    // Resolve the landing stage: explicit pick, else the first stage.
    let stage = input.stageId
      ? await prisma.crmPipelineStage.findFirst({
          where: { id: input.stageId, pipelineId },
          select: { id: true, probability: true },
        })
      : null
    if (!stage) {
      stage = await prisma.crmPipelineStage.findFirst({
        where: { pipelineId },
        orderBy: { orderIndex: 'asc' },
        select: { id: true, probability: true },
      })
    }
    if (!stage) throw new StageNotFoundError('Pipeline has no stages')

    const orderIndex = await nextOrderIndex(companyId, stage.id)

    const created = await prisma.crmOpportunity.create({
      data: {
        name: input.name,
        pipelineId,
        stageId: stage.id,
        // Status defaults OPEN at the DB level; only stamp the field
        // when the caller wants a non-default (rare — typically only
        // used when importing already-closed historical deals).
        ...(input.status ? { status: input.status } : {}),
        contactName: input.contactName ?? null,
        contactEmail: input.contactEmail ?? null,
        contactPhone: input.contactPhone ?? null,
        companyName: input.companyName ?? null,
        value: input.value ?? null,
        probability: input.probability ?? stage.probability ?? null,
        expectedCloseDate: input.expectedCloseDate ?? null,
        assignedCloserId: input.assignedCloserId ?? null,
        notes: input.notes ?? null,
        orderIndex,
        createdById: actorId,
      },
      select: {
        id: true,
        name: true,
        stageId: true,
        orderIndex: true,
        status: true,
        value: true,
        probability: true,
        contactName: true,
        companyName: true,
        expectedCloseDate: true,
        assignedCloser: CLOSER_SELECT,
        notes: true,
      },
    })
    return toListItem(created)
  }

  /** Partial update of a deal's fields (drawer / edit form). */
  async update(
    id: string,
    input: UpdateOpportunityOutput,
  ): Promise<OpportunityListItem> {
    const existing = await prisma.crmOpportunity.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    })
    if (!existing) throw new OpportunityNotFoundError()

    const updated = await prisma.crmOpportunity.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.contactName !== undefined ? { contactName: input.contactName } : {}),
        ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail } : {}),
        ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone } : {}),
        ...(input.companyName !== undefined ? { companyName: input.companyName } : {}),
        ...(input.value !== undefined ? { value: input.value } : {}),
        ...(input.probability !== undefined ? { probability: input.probability } : {}),
        ...(input.expectedCloseDate !== undefined ? { expectedCloseDate: input.expectedCloseDate } : {}),
        ...(input.assignedCloserId !== undefined ? { assignedCloserId: input.assignedCloserId } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
      select: {
        id: true,
        name: true,
        stageId: true,
        orderIndex: true,
        status: true,
        value: true,
        probability: true,
        contactName: true,
        companyName: true,
        expectedCloseDate: true,
        assignedCloser: CLOSER_SELECT,
        notes: true,
      },
    })
    return toListItem(updated)
  }

  /**
   * Move a deal to a stage + position (the Kanban drag-drop write).
   * When the target stage is terminal (isWon / isLost) the deal's
   * status + wonAt/lostAt are stamped so reporting can split closed
   * from in-flight; moving back to a non-terminal stage reopens it.
   */
  async changeStage(
    id: string,
    stageId: string,
    orderIndex?: number,
  ): Promise<OpportunityListItem> {
    const companyId = await requireCompanyId()

    const existing = await prisma.crmOpportunity.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, stageId: true, pipelineId: true },
    })
    if (!existing) throw new OpportunityNotFoundError()

    const target = await prisma.crmPipelineStage.findFirst({
      where: { id: stageId, pipelineId: existing.pipelineId },
      select: { id: true, isWon: true, isLost: true, probability: true },
    })
    if (!target) throw new StageNotFoundError()

    const finalOrderIndex =
      orderIndex ?? (await nextOrderIndex(companyId, stageId))

    const status = target.isWon ? 'WON' : target.isLost ? 'LOST' : 'OPEN'

    const updated = await prisma.crmOpportunity.update({
      where: { id },
      data: {
        stageId,
        orderIndex: finalOrderIndex,
        status,
        // Stamp / clear the close timestamps to match the new status.
        wonAt: target.isWon ? new Date() : null,
        lostAt: target.isLost ? new Date() : null,
        // A won deal is 100% by definition; a lost one 0%. Otherwise
        // inherit the stage's default probability when it has one.
        ...(target.isWon
          ? { probability: 100 }
          : target.isLost
            ? { probability: 0 }
            : target.probability !== null
              ? { probability: target.probability }
              : {}),
      },
      select: {
        id: true,
        name: true,
        stageId: true,
        orderIndex: true,
        status: true,
        value: true,
        probability: true,
        contactName: true,
        companyName: true,
        expectedCloseDate: true,
        assignedCloser: CLOSER_SELECT,
        notes: true,
      },
    })
    return toListItem(updated)
  }

  /**
   * Bulk-insert opportunities parsed from a CSV. Each row's stageName
   * is resolved case-insensitively against the target pipeline's
   * stages; unknown / missing stages fall back to the pipeline's
   * first stage. Returns per-row created count so the dialog can toast.
   */
  async importFromCsv(input: {
    pipelineId: string
    rows: Array<{
      name: string
      contactName?: string | null
      contactEmail?: string | null
      contactPhone?: string | null
      companyName?: string | null
      value?: number | null
      probability?: number | null
      stageName?: string | null
    }>
    assignedCloserId?: string | null
    actorId: string | null
  }): Promise<{ created: number; skipped: number }> {
    const companyId = await requireCompanyId()

    const stages = await prisma.crmPipelineStage.findMany({
      where: { pipelineId: input.pipelineId },
      orderBy: { orderIndex: 'asc' },
      select: { id: true, name: true, slug: true, probability: true },
    })
    if (stages.length === 0) {
      throw new StageNotFoundError('Pipeline has no stages')
    }
    const defaultStage = stages[0]!
    const stageByKey = new Map<string, (typeof stages)[number]>()
    for (const s of stages) {
      stageByKey.set(s.name.toLowerCase(), s)
      stageByKey.set(s.slug.toLowerCase(), s)
    }

    // Pull the current tail orderIndex per stage so imports don't
    // collide with existing cards, then bump as we insert.
    const nextOrderPerStage = new Map<string, number>()
    for (const s of stages) {
      const last = await prisma.crmOpportunity.findFirst({
        where: { stageId: s.id, deletedAt: null },
        orderBy: { orderIndex: 'desc' },
        select: { orderIndex: true },
      })
      nextOrderPerStage.set(s.id, (last?.orderIndex ?? 0) + 100)
    }

    let created = 0
    let skipped = 0
    for (const row of input.rows) {
      const key = row.stageName?.toLowerCase().trim()
      const stage = (key && stageByKey.get(key)) || defaultStage
      const orderIndex = nextOrderPerStage.get(stage.id)!
      nextOrderPerStage.set(stage.id, orderIndex + 100)

      try {
        await prisma.crmOpportunity.create({
          data: {
            name: row.name,
            pipelineId: input.pipelineId,
            stageId: stage.id,
            contactName: row.contactName ?? null,
            contactEmail: row.contactEmail ?? null,
            contactPhone: row.contactPhone ?? null,
            companyName: row.companyName ?? null,
            value: row.value ?? null,
            probability: row.probability ?? stage.probability ?? null,
            assignedCloserId: input.assignedCloserId ?? null,
            orderIndex,
            createdById: input.actorId,
            companyId,
          },
        })
        created++
      } catch {
        skipped++
      }
    }
    return { created, skipped }
  }

  /** Soft-delete (archive) a deal off the board. */
  async softDelete(id: string): Promise<void> {
    const existing = await prisma.crmOpportunity.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    })
    if (!existing) throw new OpportunityNotFoundError()
    await prisma.crmOpportunity.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }
}

export const crmOpportunityService = new CrmOpportunityService()

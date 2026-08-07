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
import { crmLeadService } from '@/lib/services/crm-lead-service'
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

/** RFC-4180-ish: wrap the field in quotes if it contains a comma,
 *  double-quote, or line-break; double any embedded quotes. Every
 *  other value passes through unchanged. Matches the parser in
 *  import-opportunities-dialog so exports round-trip losslessly. */
function csvEscape(v: string): string {
  if (v === '') return ''
  if (/[",\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}

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

/** Compact contact reference embedded in each card/detail response. */
export interface OpportunityContactRef {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  companyName: string | null
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
  /** The linked contact — GHL model. Nullable only for legacy rows
   *  whose backfill couldn't match anything (should be rare after
   *  P0 #3 lands). */
  contact: OpportunityContactRef | null
  /** Derived from `contact.fullName` when linked, or the legacy
   *  free-text contact_name column for un-migrated rows. Kept as a
   *  top-level convenience so board cards don't drill into `contact`. */
  contactName: string | null
  /** Same story: from `contact.companyName` if linked, else legacy. */
  companyName: string | null
  expectedCloseDate: Date | null
  assignedCloser: OpportunityCloser | null
  /** True when the free-text notes field on the row is populated —
   *  legacy indicator kept for CSV-imported deals. The timeline count
   *  below is what the card shows for new activity. */
  hasNotes: boolean
  /** Free-text lead source (e.g. "Facebook", "Referral"). */
  source: string | null
  /** Total notes in the timeline table (0 when the tab hasn't been used). */
  noteCount: number
  /** Only tasks still open — the card badge is about outstanding work,
   *  not completed history. */
  openTaskCount: number
  /** Funnel qualification: true = qualified, false = unqualified, null =
   *  not applicable (partial / manual / legacy). Drives the card badge
   *  and stays put as the deal moves across stages. */
  qualified: boolean | null
}

const CLOSER_SELECT = {
  select: { id: true, name: true, email: true, avatarUrl: true },
} as const satisfies Prisma.UserDefaultArgs

const CONTACT_SELECT = {
  select: {
    id: true,
    fullName: true,
    email: true,
    phone: true,
    companyName: true,
  },
} as const satisfies Prisma.CrmLeadDefaultArgs

interface ToListItemRow {
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
  contact: OpportunityContactRef | null
  notes: string | null
  source: string | null
  qualified?: boolean | null
  noteCount?: number
  openTaskCount?: number
}

function toListItem(row: ToListItemRow): OpportunityListItem {
  // Prefer the linked contact when present; fall back to the legacy
  // free-text columns so pre-backfill / un-linked rows still render.
  const displayName = row.contact?.fullName ?? row.contactName
  const displayCompany = row.contact?.companyName ?? row.companyName
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
    contact: row.contact,
    contactName: displayName,
    companyName: displayCompany,
    expectedCloseDate: row.expectedCloseDate,
    assignedCloser: row.assignedCloser,
    hasNotes: row.notes !== null && row.notes.trim().length > 0,
    source: row.source,
    qualified: row.qualified ?? null,
    noteCount: row.noteCount ?? 0,
    openTaskCount: row.openTaskCount ?? 0,
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
        contact: CONTACT_SELECT,
        notes: true,
        source: true,
        qualified: true,
        _count: {
          select: {
            noteEntries: true,
            tasks: { where: { completedAt: null } },
          },
        },
      },
    })
    return rows.map((row) =>
      toListItem({
        ...row,
        noteCount: row._count.noteEntries,
        openTaskCount: row._count.tasks,
      }),
    )
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
        source: true,
        assignedCloser: CLOSER_SELECT,
        contact: CONTACT_SELECT,
        _count: {
          select: {
            noteEntries: true,
            tasks: { where: { completedAt: null } },
          },
        },
      },
    })
    if (!row) throw new OpportunityNotFoundError()
    const base = toListItem({
      ...row,
      noteCount: row._count.noteEntries,
      openTaskCount: row._count.tasks,
    })
    return {
      ...base,
      // Prefer contact fields when linked; fall back to legacy free-text.
      contactEmail: row.contact?.email ?? row.contactEmail,
      contactPhone: row.contact?.phone ?? row.contactPhone,
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

    // Resolve the contact: explicit contactId wins; otherwise
    // find-or-create from the inline free-text fields. We still write
    // the denormalized contactName/email/phone/companyName so the
    // board's search (which greps on those columns) keeps working
    // without a join.
    const contactId = await resolveContactId(input, actorId)

    const created = await prisma.crmOpportunity.create({
      data: {
        name: input.name,
        pipelineId,
        stageId: stage.id,
        // Status defaults OPEN at the DB level; only stamp the field
        // when the caller wants a non-default (rare — typically only
        // used when importing already-closed historical deals).
        ...(input.status ? { status: input.status } : {}),
        contactId,
        contactName: input.contactName ?? null,
        contactEmail: input.contactEmail ?? null,
        contactPhone: input.contactPhone ?? null,
        companyName: input.companyName ?? null,
        value: input.value ?? null,
        probability: input.probability ?? stage.probability ?? null,
        expectedCloseDate: input.expectedCloseDate ?? null,
        assignedCloserId: input.assignedCloserId ?? null,
        notes: input.notes ?? null,
        source: input.source ?? null,
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
        contact: CONTACT_SELECT,
        notes: true,
        source: true,
      },
    })
    return toListItem(created)
  }

  /** Partial update of a deal's fields (drawer / edit form). */
  async update(
    id: string,
    input: UpdateOpportunityOutput,
    actorId: string | null = null,
  ): Promise<OpportunityListItem> {
    const existing = await prisma.crmOpportunity.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, contactId: true },
    })
    if (!existing) throw new OpportunityNotFoundError()

    // Resolve the contact when the caller either sent a contactId
    // (a picker change) or touched one of the inline fields (legacy
    // free-text edit). Undefined = don't touch the FK.
    const contactId = await resolveContactIdForUpdate(input, actorId)

    const updated = await prisma.crmOpportunity.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(contactId !== undefined ? { contactId } : {}),
        ...(input.contactName !== undefined ? { contactName: input.contactName } : {}),
        ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail } : {}),
        ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone } : {}),
        ...(input.companyName !== undefined ? { companyName: input.companyName } : {}),
        ...(input.value !== undefined ? { value: input.value } : {}),
        ...(input.probability !== undefined ? { probability: input.probability } : {}),
        ...(input.expectedCloseDate !== undefined ? { expectedCloseDate: input.expectedCloseDate } : {}),
        ...(input.assignedCloserId !== undefined ? { assignedCloserId: input.assignedCloserId } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.source !== undefined ? { source: input.source } : {}),
        ...(input.status !== undefined
          ? {
              status: input.status,
              // Keep wonAt/lostAt in sync with a manual status flip so
              // the same reporting queries that read those stamps
              // (Won-this-month, Lost-in-Q2 etc.) still line up.
              wonAt: input.status === 'WON' ? new Date() : null,
              lostAt: input.status === 'LOST' ? new Date() : null,
            }
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
        contact: CONTACT_SELECT,
        notes: true,
        source: true,
        _count: {
          select: {
            noteEntries: true,
            tasks: { where: { completedAt: null } },
          },
        },
      },
    })
    return toListItem({
      ...updated,
      noteCount: updated._count.noteEntries,
      openTaskCount: updated._count.tasks,
    })
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

    // Look up the target stage without pinning it to the deal's
    // current pipeline — this is the same write path used by
    // Kanban drag-drop (same-pipeline) AND by the edit dialog when
    // the user picks a different pipeline. Tenancy is enforced by
    // the Prisma extension.
    const target = await prisma.crmPipelineStage.findFirst({
      where: { id: stageId },
      select: {
        id: true,
        pipelineId: true,
        isWon: true,
        isLost: true,
        probability: true,
      },
    })
    if (!target) throw new StageNotFoundError()

    const crossPipeline = target.pipelineId !== existing.pipelineId
    // A cross-pipeline move always drops the card at the tail of its
    // destination column — there's no drag position to honour.
    const finalOrderIndex = crossPipeline
      ? await nextOrderIndex(companyId, stageId)
      : (orderIndex ?? (await nextOrderIndex(companyId, stageId)))

    const status = target.isWon ? 'WON' : target.isLost ? 'LOST' : 'OPEN'

    const updated = await prisma.crmOpportunity.update({
      where: { id },
      data: {
        ...(crossPipeline ? { pipelineId: target.pipelineId } : {}),
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
        contact: CONTACT_SELECT,
        notes: true,
        source: true,
        _count: {
          select: {
            noteEntries: true,
            tasks: { where: { completedAt: null } },
          },
        },
      },
    })
    return toListItem({
      ...updated,
      noteCount: updated._count.noteEntries,
      openTaskCount: updated._count.tasks,
    })
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
      notes?: string | null
    }>
    assignedCloserId?: string | null
    actorId: string | null
    /** Import mode from the wizard. CREATE_OR_UPDATE / UPDATE_ONLY
     *  match existing opportunities by (pipelineId, contactEmail):
     *  the same contact + pipeline shouldn't accrue duplicate deals
     *  when the same file is uploaded twice. */
    mode?: 'CREATE_ONLY' | 'CREATE_OR_UPDATE' | 'UPDATE_ONLY'
  }): Promise<{
    created: number
    updated: number
    skipped: number
    contactsCreated: number
    contactsLinked: number
  }> {
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

    const mode = input.mode ?? 'CREATE_ONLY'
    let created = 0
    let updated = 0
    let skipped = 0
    let contactsCreated = 0
    let contactsLinked = 0
    for (const row of input.rows) {
      const key = row.stageName?.toLowerCase().trim()
      const stage = (key && stageByKey.get(key)) || defaultStage

      // Dedupe against existing contacts by email (fallback to name).
      // Track whether we hit an existing row so the import summary
      // can show N-new-contacts vs N-linked.
      const hadEmail = !!row.contactEmail?.trim()
      const contactCountBefore = hadEmail
        ? await prisma.crmLead.count({
            where: {
              deletedAt: null,
              email: {
                equals: row.contactEmail!.trim(),
                mode: 'insensitive',
              },
            },
          })
        : 0
      const contactId =
        row.contactName || row.contactEmail || row.contactPhone
          ? await crmLeadService.findOrCreateByContact({
              fullName: row.contactName,
              email: row.contactEmail,
              phone: row.contactPhone,
              companyName: row.companyName,
              source: 'CSV_IMPORT',
              actorId: input.actorId,
            })
          : null
      if (contactId) {
        if (hadEmail && contactCountBefore > 0) contactsLinked++
        else contactsCreated++
      }

      // Look for an existing opportunity to update when the mode
      // asks for it: same pipeline + same linked contact. That's
      // the tightest match GHL supports without a stable per-deal
      // external id, and it stops re-uploading a file from
      // duplicating deals for the same person.
      const existing =
        mode !== 'CREATE_ONLY' && contactId
          ? await prisma.crmOpportunity.findFirst({
              where: {
                pipelineId: input.pipelineId,
                contactId,
                deletedAt: null,
              },
              select: { id: true },
            })
          : null

      try {
        if (existing) {
          await prisma.crmOpportunity.update({
            where: { id: existing.id },
            data: {
              ...(row.name ? { name: row.name } : {}),
              stageId: stage.id,
              ...(row.contactName !== undefined
                ? { contactName: row.contactName ?? null }
                : {}),
              ...(row.contactEmail !== undefined
                ? { contactEmail: row.contactEmail ?? null }
                : {}),
              ...(row.contactPhone !== undefined
                ? { contactPhone: row.contactPhone ?? null }
                : {}),
              ...(row.companyName !== undefined
                ? { companyName: row.companyName ?? null }
                : {}),
              ...(row.value !== undefined ? { value: row.value } : {}),
              ...(row.probability !== undefined
                ? {
                    probability:
                      row.probability ?? stage.probability ?? null,
                  }
                : {}),
              ...(input.assignedCloserId !== undefined
                ? { assignedCloserId: input.assignedCloserId ?? null }
                : {}),
              ...(row.notes?.trim() ? { notes: row.notes.trim() } : {}),
            },
          })
          updated++
        } else if (mode === 'UPDATE_ONLY') {
          skipped++
        } else {
          const orderIndex = nextOrderPerStage.get(stage.id)!
          nextOrderPerStage.set(stage.id, orderIndex + 100)
          await prisma.crmOpportunity.create({
            data: {
              name: row.name,
              pipelineId: input.pipelineId,
              stageId: stage.id,
              contactId,
              contactName: row.contactName ?? null,
              contactEmail: row.contactEmail ?? null,
              contactPhone: row.contactPhone ?? null,
              companyName: row.companyName ?? null,
              value: row.value ?? null,
              probability: row.probability ?? stage.probability ?? null,
              assignedCloserId: input.assignedCloserId ?? null,
              notes: row.notes?.trim() ? row.notes.trim() : null,
              orderIndex,
              createdById: input.actorId,
              companyId,
            },
          })
          created++
        }
      } catch {
        skipped++
      }
    }
    return { created, updated, skipped, contactsCreated, contactsLinked }
  }

  /**
   * Serialise every non-deleted opportunity in `pipelineId` as an
   * RFC-4180-ish CSV whose column names match the importer's
   * aliases (name, contact, email, phone, company, value,
   * probability, stage, notes). Round-trip clean: export a
   * pipeline, re-import the file, get the same shape back.
   */
  async exportToCsv(pipelineId: string): Promise<{
    filename: string
    csv: string
  }> {
    const [pipeline, rows] = await Promise.all([
      prisma.crmPipeline.findFirst({
        where: { id: pipelineId },
        select: { name: true, slug: true },
      }),
      prisma.crmOpportunity.findMany({
        where: { pipelineId, deletedAt: null },
        orderBy: [{ stageId: 'asc' }, { orderIndex: 'asc' }],
        select: {
          name: true,
          contactName: true,
          contactEmail: true,
          contactPhone: true,
          companyName: true,
          value: true,
          probability: true,
          notes: true,
          stage: { select: { name: true } },
        },
      }),
    ])

    const header = [
      'name',
      'contact',
      'email',
      'phone',
      'company',
      'value',
      'probability',
      'stage',
      'notes',
    ]
    const lines: string[] = [header.join(',')]
    for (const r of rows) {
      lines.push(
        [
          r.name,
          r.contactName ?? '',
          r.contactEmail ?? '',
          r.contactPhone ?? '',
          r.companyName ?? '',
          r.value === null ? '' : String(r.value),
          r.probability === null ? '' : String(r.probability),
          r.stage.name,
          r.notes ?? '',
        ]
          .map(csvEscape)
          .join(','),
      )
    }

    const date = new Date().toISOString().slice(0, 10)
    const slug = pipeline?.slug ?? 'pipeline'
    return {
      filename: `opportunities-${slug}-${date}.csv`,
      // Trailing newline keeps Excel + `wc -l` honest on the last row.
      csv: lines.join('\n') + '\n',
    }
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

/**
 * Resolve the contact for a NEW opportunity. Precedence:
 *  1. Explicit `contactId` in input (picker chose an existing contact).
 *  2. Any inline free-text contact field → find-or-create by email/name.
 *  3. Neither → null (rare; only happens when the caller intentionally
 *     leaves the deal detached).
 */
async function resolveContactId(
  input: CreateOpportunityOutput,
  actorId: string | null,
): Promise<string | null> {
  if (input.contactId) return input.contactId
  const hasInlineContact =
    !!input.contactName?.trim() ||
    !!input.contactEmail?.trim() ||
    !!input.contactPhone?.trim() ||
    !!input.companyName?.trim()
  if (!hasInlineContact) return null
  return crmLeadService.findOrCreateByContact({
    fullName: input.contactName,
    email: input.contactEmail,
    phone: input.contactPhone,
    companyName: input.companyName,
    source: 'MANUAL',
    actorId,
  })
}

/**
 * Update-path variant. Returns `undefined` when the caller didn't
 * touch contact info (leave the FK alone), `null` when the caller
 * explicitly cleared it, or a string id otherwise. The three-state
 * return maps directly onto Prisma's spread-if-defined pattern.
 */
async function resolveContactIdForUpdate(
  input: UpdateOpportunityOutput,
  actorId: string | null,
): Promise<string | null | undefined> {
  // Explicit contactId in the payload — picker change.
  if (input.contactId !== undefined) return input.contactId

  const touchedInline =
    input.contactName !== undefined ||
    input.contactEmail !== undefined ||
    input.contactPhone !== undefined ||
    input.companyName !== undefined
  if (!touchedInline) return undefined

  const hasAnyValue =
    !!input.contactName?.trim() ||
    !!input.contactEmail?.trim() ||
    !!input.contactPhone?.trim() ||
    !!input.companyName?.trim()
  if (!hasAnyValue) return null

  return crmLeadService.findOrCreateByContact({
    fullName: input.contactName,
    email: input.contactEmail,
    phone: input.contactPhone,
    companyName: input.companyName,
    source: 'MANUAL',
    actorId,
  })
}

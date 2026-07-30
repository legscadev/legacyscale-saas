// Read/write helpers for CRM leads (P0 #2).
//
// Covers the lead inbox lifecycle: capture (manual + CSV), dedupe
// warning, assign to a setter, status changes, and conversion into a
// pipeline deal. Conversion delegates to crm-opportunity-service so
// the deal lands on the board exactly like a hand-created one, then
// stamps the lead CONVERTED + links it to the spawned opportunity.
//
// Tenant scoping is automatic via the Prisma extension for top-level
// ops (all reads/writes here are top-level).

import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { getRequestCompanyId } from '@/lib/tenancy/request-company'
import { crmOpportunityService } from '@/lib/services/crm-opportunity-service'
import { crmPipelineService } from '@/lib/services/crm-pipeline-service'
import type {
  ConvertLeadOutput,
  CreateLeadOutput,
  CrmLeadStatusValue,
  ImportLeadsOutput,
  LeadFilterOutput,
  UpdateLeadOutput,
} from '@/lib/validations/crm-lead'

export class LeadNotFoundError extends Error {
  constructor(message = 'Lead not found') {
    super(message)
    this.name = 'LeadNotFoundError'
  }
}

export class LeadAlreadyConvertedError extends Error {
  constructor(message = 'Lead has already been converted') {
    super(message)
    this.name = 'LeadAlreadyConvertedError'
  }
}

async function requireCompanyId(): Promise<string> {
  const id = await getRequestCompanyId()
  if (!id) throw new Error('crm-lead-service: no active company')
  return id
}

// ============================================
// SHAPES
// ============================================

export interface LeadUserRef {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
}

export interface LeadListItem {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  companyName: string | null
  source: string
  campaign: string | null
  industry: string | null
  status: CrmLeadStatusValue
  assignedSetter: LeadUserRef | null
  convertedOpportunityId: string | null
  lastActivityAt: Date | null
  createdAt: Date
  /** Total opportunities linked to this contact (any status). Zero
   *  for un-converted leads; positive once at least one deal exists. */
  opportunityCount: number
}

export interface LeadListResult {
  items: LeadListItem[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasMore: boolean
}

const SETTER_SELECT = {
  select: { id: true, name: true, email: true, avatarUrl: true },
} as const satisfies Prisma.UserDefaultArgs

const LIST_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  companyName: true,
  source: true,
  campaign: true,
  industry: true,
  status: true,
  convertedOpportunityId: true,
  lastActivityAt: true,
  createdAt: true,
  assignedSetter: SETTER_SELECT,
  _count: { select: { opportunities: true } },
} as const satisfies Prisma.CrmLeadSelect

type LeadRow = Prisma.CrmLeadGetPayload<{ select: typeof LIST_SELECT }>

function toListItem(row: LeadRow): LeadListItem {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    companyName: row.companyName,
    source: row.source,
    campaign: row.campaign,
    industry: row.industry,
    status: row.status as CrmLeadStatusValue,
    assignedSetter: row.assignedSetter,
    convertedOpportunityId: row.convertedOpportunityId,
    lastActivityAt: row.lastActivityAt,
    createdAt: row.createdAt,
    opportunityCount: row._count.opportunities,
  }
}

class CrmLeadService {
  /** Paginated contacts list. Converted contacts are hidden only if
   *  the caller explicitly opts out (GHL model: Contacts is the
   *  master list, everyone belongs by default). */
  async list(filters: LeadFilterOutput): Promise<LeadListResult> {
    const where: Prisma.CrmLeadWhereInput = { deletedAt: null }

    if (!filters.includeConverted) {
      where.status = { not: 'CONVERTED' }
    }
    if (filters.statuses.length > 0) {
      where.status = { in: filters.statuses }
    }
    if (filters.sources.length > 0) {
      where.source = { in: filters.sources }
    }
    if (filters.assigneeIds.length > 0) {
      where.assignedSetterId = { in: filters.assigneeIds }
    }
    if (filters.hasEmail === true) {
      where.email = { not: null }
    } else if (filters.hasEmail === false) {
      where.email = null
    }
    if (filters.hasPhone === true) {
      where.phone = { not: null }
    } else if (filters.hasPhone === false) {
      where.phone = null
    }
    if (filters.companyName) {
      where.companyName = {
        contains: filters.companyName,
        mode: 'insensitive',
      }
    }
    if (filters.createdFrom || filters.createdTo) {
      where.createdAt = {
        ...(filters.createdFrom ? { gte: filters.createdFrom } : {}),
        ...(filters.createdTo ? { lte: filters.createdTo } : {}),
      }
    }
    if (filters.lastActivityFrom || filters.lastActivityTo) {
      where.lastActivityAt = {
        ...(filters.lastActivityFrom ? { gte: filters.lastActivityFrom } : {}),
        ...(filters.lastActivityTo ? { lte: filters.lastActivityTo } : {}),
      }
    }
    if (filters.search) {
      where.OR = [
        { fullName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
        { companyName: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    // orderBy resolution — the added sort fields (email/phone/
    // companyName) let column-header clicks work everywhere GHL does.
    // `nulls: 'last'` isn't a Prisma default so we spell it out on
    // nullable columns to keep empty cells at the bottom.
    let orderBy: Prisma.CrmLeadOrderByWithRelationInput
    switch (filters.sortBy) {
      case 'fullName':
        orderBy = { fullName: filters.sortOrder }
        break
      case 'status':
        orderBy = { status: filters.sortOrder }
        break
      case 'lastActivityAt':
        orderBy = {
          lastActivityAt: { sort: filters.sortOrder, nulls: 'last' },
        }
        break
      case 'email':
        orderBy = { email: { sort: filters.sortOrder, nulls: 'last' } }
        break
      case 'phone':
        orderBy = { phone: { sort: filters.sortOrder, nulls: 'last' } }
        break
      case 'companyName':
        orderBy = {
          companyName: { sort: filters.sortOrder, nulls: 'last' },
        }
        break
      case 'createdAt':
      default:
        orderBy = { createdAt: filters.sortOrder }
        break
    }

    const [total, rows] = await Promise.all([
      prisma.crmLead.count({ where }),
      prisma.crmLead.findMany({
        where,
        orderBy,
        select: LIST_SELECT,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
    ])

    const totalPages = Math.max(1, Math.ceil(total / filters.limit))
    return {
      items: rows.map(toListItem),
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages,
      hasMore: filters.page < totalPages,
    }
  }

  /**
   * Non-deleted leads that share an email or phone with the given
   * values. Used to warn on manual create — not a hard block, since
   * the same person can legitimately come in twice.
   */
  async findPotentialDuplicates(input: {
    email?: string | null
    phone?: string | null
  }): Promise<LeadListItem[]> {
    const or: Prisma.CrmLeadWhereInput[] = []
    if (input.email) or.push({ email: { equals: input.email, mode: 'insensitive' } })
    if (input.phone) or.push({ phone: input.phone })
    if (or.length === 0) return []

    const rows = await prisma.crmLead.findMany({
      where: { deletedAt: null, OR: or },
      orderBy: { createdAt: 'desc' },
      select: LIST_SELECT,
      take: 5,
    })
    return rows.map(toListItem)
  }

  async get(id: string): Promise<LeadListItem & {
    secondaryPhone: string | null
    address: string | null
    notes: string | null
  }> {
    const row = await prisma.crmLead.findFirst({
      where: { id, deletedAt: null },
      select: {
        ...LIST_SELECT,
        secondaryPhone: true,
        address: true,
        notes: true,
      },
    })
    if (!row) throw new LeadNotFoundError()
    return {
      ...toListItem(row),
      secondaryPhone: row.secondaryPhone,
      address: row.address,
      notes: row.notes,
    }
  }

  async create(
    input: CreateLeadOutput,
    actorId: string | null,
  ): Promise<LeadListItem> {
    const row = await prisma.crmLead.create({
      data: {
        fullName: input.fullName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        secondaryPhone: input.secondaryPhone ?? null,
        companyName: input.companyName ?? null,
        address: input.address ?? null,
        source: input.source,
        campaign: input.campaign ?? null,
        industry: input.industry ?? null,
        status: input.status,
        assignedSetterId: input.assignedSetterId ?? null,
        notes: input.notes ?? null,
        lastActivityAt: new Date(),
        createdById: actorId,
      },
      select: LIST_SELECT,
    })
    return toListItem(row)
  }

  async update(id: string, input: UpdateLeadOutput): Promise<LeadListItem> {
    await this.assertExists(id)
    const row = await prisma.crmLead.update({
      where: { id },
      data: {
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.secondaryPhone !== undefined ? { secondaryPhone: input.secondaryPhone } : {}),
        ...(input.companyName !== undefined ? { companyName: input.companyName } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.source !== undefined ? { source: input.source } : {}),
        ...(input.campaign !== undefined ? { campaign: input.campaign } : {}),
        ...(input.industry !== undefined ? { industry: input.industry } : {}),
        ...(input.assignedSetterId !== undefined ? { assignedSetterId: input.assignedSetterId } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        lastActivityAt: new Date(),
      },
      select: LIST_SELECT,
    })
    return toListItem(row)
  }

  async changeStatus(
    id: string,
    status: CrmLeadStatusValue,
  ): Promise<LeadListItem> {
    await this.assertExists(id)
    const row = await prisma.crmLead.update({
      where: { id },
      data: { status, lastActivityAt: new Date() },
      select: LIST_SELECT,
    })
    return toListItem(row)
  }

  async assignSetter(
    id: string,
    setterId: string | null,
  ): Promise<LeadListItem> {
    await this.assertExists(id)
    const row = await prisma.crmLead.update({
      where: { id },
      data: { assignedSetterId: setterId, lastActivityAt: new Date() },
      select: LIST_SELECT,
    })
    return toListItem(row)
  }

  /**
   * Convert a lead into a pipeline deal. Creates a CrmOpportunity via
   * the opportunity service (so it lands on the board like any other
   * deal), then flips the lead to CONVERTED and links it. Contact
   * fields copy across as free text — P0 #3 inserts a crm_contact
   * here.
   */
  async convertToOpportunity(
    input: ConvertLeadOutput,
    actorId: string | null,
  ): Promise<{ opportunityId: string }> {
    const lead = await prisma.crmLead.findFirst({
      where: { id: input.leadId, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        companyName: true,
        status: true,
        convertedOpportunityId: true,
        assignedSetterId: true,
      },
    })
    if (!lead) throw new LeadNotFoundError()
    if (lead.status === 'CONVERTED' || lead.convertedOpportunityId) {
      throw new LeadAlreadyConvertedError()
    }

    const pipelineId = await crmPipelineService.resolvePipelineId(
      input.pipelineId,
    )
    if (!pipelineId) throw new Error('No pipeline available to convert into')

    const opportunity = await crmOpportunityService.create(
      pipelineId,
      {
        name: lead.companyName ?? lead.fullName,
        stageId: input.stageId,
        contactName: lead.fullName,
        contactEmail: lead.email,
        contactPhone: lead.phone,
        companyName: lead.companyName,
        value: input.value ?? null,
        assignedCloserId: input.assignedCloserId ?? null,
        assigneeIds: [],
      } as never,
      actorId,
    )

    await prisma.crmLead.update({
      where: { id: lead.id },
      data: {
        status: 'CONVERTED',
        convertedAt: new Date(),
        convertedOpportunityId: opportunity.id,
        lastActivityAt: new Date(),
      },
    })

    return { opportunityId: opportunity.id }
  }

  /**
   * Bulk import parsed CSV rows. Supports three modes matching the
   * GHL wizard:
   *   - CREATE_ONLY (legacy): every row inserts a new lead; rows that
   *     collide with an existing (companyId, email) row are still
   *     inserted (dedupe is up to the caller).
   *   - CREATE_OR_UPDATE: match by email → update in place if found,
   *     otherwise insert.
   *   - UPDATE_ONLY: match by email → update in place if found,
   *     otherwise skip the row.
   *
   * Row-level counts (created/updated/skipped) drive the wizard's
   * Verify screen + the import-history page.
   */
  async importCsv(
    input: ImportLeadsOutput,
    actorId: string | null,
    mode: 'CREATE_ONLY' | 'CREATE_OR_UPDATE' | 'UPDATE_ONLY' = 'CREATE_ONLY',
  ): Promise<{ created: number; updated: number; skipped: number }> {
    const companyId = await requireCompanyId()
    const now = new Date()

    // Fast path — the legacy behaviour. createMany is one round-trip
    // for the whole batch; anything with per-row logic (update /
    // skip / upsert) has to loop.
    if (mode === 'CREATE_ONLY') {
      const result = await prisma.crmLead.createMany({
        data: input.rows.map((r) => ({
          fullName: r.fullName,
          email: r.email ?? null,
          phone: r.phone ?? null,
          companyName: r.companyName ?? null,
          industry: r.industry ?? null,
          campaign: r.campaign ?? null,
          source: 'CSV_IMPORT' as const,
          status: 'NEW' as const,
          assignedSetterId: input.assignedSetterId ?? null,
          createdById: actorId,
          lastActivityAt: now,
          companyId,
        })),
      })
      return { created: result.count, updated: 0, skipped: 0 }
    }

    let created = 0
    let updated = 0
    let skipped = 0

    for (const r of input.rows) {
      const email = r.email?.trim() || null
      const existing = email
        ? await prisma.crmLead.findFirst({
            where: {
              deletedAt: null,
              email: { equals: email, mode: 'insensitive' },
            },
            select: { id: true },
          })
        : null

      if (existing) {
        // Update path — refresh non-empty fields, don't overwrite
        // with blanks (import shouldn't destroy manual edits).
        await prisma.crmLead.update({
          where: { id: existing.id },
          data: {
            ...(r.fullName ? { fullName: r.fullName } : {}),
            ...(r.phone ? { phone: r.phone } : {}),
            ...(r.companyName ? { companyName: r.companyName } : {}),
            ...(r.industry ? { industry: r.industry } : {}),
            ...(r.campaign ? { campaign: r.campaign } : {}),
            ...(input.assignedSetterId !== undefined
              ? { assignedSetterId: input.assignedSetterId ?? null }
              : {}),
            lastActivityAt: now,
          },
        })
        updated++
      } else if (mode === 'UPDATE_ONLY') {
        skipped++
      } else {
        await prisma.crmLead.create({
          data: {
            fullName: r.fullName,
            email,
            phone: r.phone ?? null,
            companyName: r.companyName ?? null,
            industry: r.industry ?? null,
            campaign: r.campaign ?? null,
            source: 'CSV_IMPORT',
            status: 'NEW',
            assignedSetterId: input.assignedSetterId ?? null,
            createdById: actorId,
            lastActivityAt: now,
            companyId,
          },
        })
        created++
      }
    }

    return { created, updated, skipped }
  }

  async softDelete(id: string): Promise<void> {
    await this.assertExists(id)
    await prisma.crmLead.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }

  /**
   * Search-as-you-type feed for the contact picker on the opportunity
   * dialogs. Case-insensitive prefix/substring match against name +
   * email; capped for latency. Returns the same LIST_SELECT shape so
   * the picker can render name + email + company.
   */
  async searchForPicker(query: string, limit = 10): Promise<LeadListItem[]> {
    const q = query.trim()
    // Empty query returns the most-recent contacts so the picker isn't
    // blank when first opened.
    const rows = await prisma.crmLead.findMany({
      where: {
        deletedAt: null,
        ...(q.length > 0
          ? {
              OR: [
                { fullName: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { companyName: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ lastActivityAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      select: LIST_SELECT,
    })
    return rows.map(toListItem)
  }

  /**
   * The write path for "new opportunity with a contact that may or may
   * not exist yet". Dedupe by email first (case-insensitive), then
   * fall back to name + companyName; create a fresh lead if neither
   * matches. Returns the resolved lead id so the caller can wire it
   * as CrmOpportunity.contactId.
   */
  async findOrCreateByContact(input: {
    fullName?: string | null
    email?: string | null
    phone?: string | null
    companyName?: string | null
    source?: 'MANUAL' | 'CSV_IMPORT' | 'API' | 'WEBHOOK'
    actorId: string | null
  }): Promise<string> {
    const email = input.email?.trim() || null
    const name = input.fullName?.trim() || null
    const company = input.companyName?.trim() || null

    if (email) {
      const existing = await prisma.crmLead.findFirst({
        where: {
          deletedAt: null,
          email: { equals: email, mode: 'insensitive' },
        },
        select: { id: true },
      })
      if (existing) return existing.id
    } else if (name) {
      // No email → name-based dedupe scoped by (name, company) so
      // "John Smith @ Acme" and "John Smith @ Beta" don't collide.
      const existing = await prisma.crmLead.findFirst({
        where: {
          deletedAt: null,
          fullName: { equals: name, mode: 'insensitive' },
          ...(company
            ? { companyName: { equals: company, mode: 'insensitive' } }
            : {}),
        },
        select: { id: true },
      })
      if (existing) return existing.id
    }

    const created = await prisma.crmLead.create({
      data: {
        fullName: name || email || 'Unnamed contact',
        email,
        phone: input.phone?.trim() || null,
        companyName: company,
        source: input.source ?? 'MANUAL',
        status: 'CONVERTED',
        lastActivityAt: new Date(),
        createdById: input.actorId,
      },
      select: { id: true },
    })
    return created.id
  }

  private async assertExists(id: string): Promise<void> {
    const row = await prisma.crmLead.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    })
    if (!row) throw new LeadNotFoundError()
  }
}

export const crmLeadService = new CrmLeadService()

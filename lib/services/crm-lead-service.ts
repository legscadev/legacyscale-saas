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
  }
}

class CrmLeadService {
  /** Paginated lead inbox. Converted leads are hidden unless the
   *  filter opts them in. */
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
    if (filters.search) {
      where.OR = [
        { fullName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
        { companyName: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    const orderBy: Prisma.CrmLeadOrderByWithRelationInput =
      filters.sortBy === 'fullName'
        ? { fullName: filters.sortOrder }
        : filters.sortBy === 'status'
          ? { status: filters.sortOrder }
          : filters.sortBy === 'lastActivityAt'
            ? { lastActivityAt: filters.sortOrder }
            : { createdAt: filters.sortOrder }

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
   * Bulk-insert parsed CSV rows. Every row is tagged CSV_IMPORT and
   * (optionally) routed to a single setter. Returns how many landed —
   * createMany skips nothing app-side, so `created` is the row count.
   */
  async importCsv(
    input: ImportLeadsOutput,
    actorId: string | null,
  ): Promise<{ created: number }> {
    const companyId = await requireCompanyId()
    const now = new Date()
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
    return { created: result.count }
  }

  async softDelete(id: string): Promise<void> {
    await this.assertExists(id)
    await prisma.crmLead.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
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

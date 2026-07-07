import type { ChecklistItemStatus, EmploymentStatus, Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import {
  MemberEmailConflictError,
  provisionMemberWithInvite,
} from '@/lib/services/member-provisioning'

/**
 * Re-export so route/action handlers that surface friendlier error
 * messages can branch on it without importing from two services.
 */
export { MemberEmailConflictError }

export interface EmployeeListItem {
  id: string
  name: string
  roleTitle: string
  status: EmploymentStatus
  onboardingDate: Date | null
  dateStarted: Date | null
  offboardingDate: Date | null
  createdAt: Date
  checklist: {
    totalItems: number
    okCount: number
    pendingCount: number
    attentionCount: number
  }
}

export interface EmployeeDetail extends EmployeeListItem {
  notes: string | null
  templateId: string | null
  updatedAt: Date
  template: {
    id: string
    slug: string
    name: string
    items: Array<{
      id: string
      label: string
      description: string | null
      orderIndex: number
      status: ChecklistItemStatus
      note: string | null
      completedAt: Date | null
    }>
  } | null
}

export interface CreateEmployeeInput {
  name: string
  roleTitle: string
  onboardingDate?: Date | null
  dateStarted?: Date | null
  templateSlug?: string | null
  /**
   * When true, the caller also provisions a TEAM-role SaaS account
   * for this hire (Supabase auth user + Invite + welcome email) and
   * links it via `Employee.userId`. `email` is required here.
   */
  grantAccess?: boolean
  email?: string
}

export interface UpdateEmployeeInput {
  name?: string
  roleTitle?: string
  onboardingDate?: Date | null
  dateStarted?: Date | null
  notes?: string | null
}

/**
 * Aggregate per-employee checklist counts. Missing status rows count
 * as "not yet touched" and are excluded from all buckets (they don't
 * show in the UI as attention items). Only rows that actually exist
 * contribute to `okCount`, `pendingCount`, `attentionCount`. The
 * denominator is the template item count so the ratio stays stable
 * as the admin walks through the list.
 */
function summarize(
  totalItems: number,
  statuses: Array<{ status: ChecklistItemStatus }>,
) {
  let okCount = 0
  let pendingCount = 0
  let attentionCount = 0
  for (const s of statuses) {
    if (s.status === 'OK') okCount++
    else if (s.status === 'PENDING') pendingCount++
    else if (s.status === 'ATTENTION') attentionCount++
  }
  return { totalItems, okCount, pendingCount, attentionCount }
}

class EmployeeService {
  async list(options: {
    status?: EmploymentStatus | 'all'
    search?: string
  } = {}): Promise<EmployeeListItem[]> {
    const where: Prisma.EmployeeWhereInput = {}
    if (options.status && options.status !== 'all') {
      where.status = options.status
    }
    const search = options.search?.trim()
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { roleTitle: { contains: search, mode: 'insensitive' } },
      ]
    }

    const employees = await prisma.employee.findMany({
      where,
      orderBy: [
        { status: 'asc' },
        { onboardingDate: 'desc' },
        { createdAt: 'desc' },
      ],
      include: {
        template: {
          select: { id: true, _count: { select: { items: true } } },
        },
        checklistStatuses: {
          select: { status: true },
        },
      },
    })

    return employees.map((e) => ({
      id: e.id,
      name: e.name,
      roleTitle: e.roleTitle,
      status: e.status,
      onboardingDate: e.onboardingDate,
      dateStarted: e.dateStarted,
      offboardingDate: e.offboardingDate,
      createdAt: e.createdAt,
      checklist: summarize(
        e.template?._count.items ?? 0,
        e.checklistStatuses,
      ),
    }))
  }

  async get(id: string): Promise<EmployeeDetail> {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        template: {
          include: {
            items: { orderBy: { orderIndex: 'asc' } },
          },
        },
        checklistStatuses: true,
      },
    })
    if (!employee) throw new Error('Employee not found')

    const statusByItem = new Map(
      employee.checklistStatuses.map((s) => [s.itemId, s]),
    )

    const template = employee.template
      ? {
          id: employee.template.id,
          slug: employee.template.slug,
          name: employee.template.name,
          items: employee.template.items.map((item) => {
            const status = statusByItem.get(item.id)
            return {
              id: item.id,
              label: item.label,
              description: item.description,
              orderIndex: item.orderIndex,
              // Missing rows show as PENDING in the UI. It's a
              // cleaner default than NA since new hires almost
              // always start with "nothing done yet".
              status: status?.status ?? ('PENDING' as ChecklistItemStatus),
              note: status?.note ?? null,
              completedAt: status?.completedAt ?? null,
            }
          }),
        }
      : null

    return {
      id: employee.id,
      name: employee.name,
      roleTitle: employee.roleTitle,
      status: employee.status,
      onboardingDate: employee.onboardingDate,
      dateStarted: employee.dateStarted,
      offboardingDate: employee.offboardingDate,
      notes: employee.notes,
      templateId: employee.templateId,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
      template,
      checklist: summarize(
        template?.items.length ?? 0,
        employee.checklistStatuses,
      ),
    }
  }

  async create(input: CreateEmployeeInput): Promise<EmployeeDetail> {
    const template = input.templateSlug
      ? await prisma.onboardingChecklistTemplate.findUnique({
          where: { slug: input.templateSlug },
        })
      : await prisma.onboardingChecklistTemplate.findFirst({
          where: { isDefault: true },
        })

    // If the admin ticked "Can access the system", provision the
    // TEAM-role account first. We do this before creating the
    // Employee row so that (a) email conflicts fail fast without
    // leaving an orphan HR record, and (b) `Employee.userId` can be
    // set atomically at insert time.
    let userId: string | null = null
    if (input.grantAccess) {
      if (!input.email) {
        // The zod schema already enforces this — belt-and-braces for
        // callers that skip validation.
        throw new Error('Email is required to grant system access')
      }
      const member = await provisionMemberWithInvite({
        name: input.name,
        email: input.email,
        role: 'TEAM',
      })
      userId = member.id
    }

    const employee = await prisma.employee.create({
      data: {
        name: input.name,
        roleTitle: input.roleTitle,
        onboardingDate: input.onboardingDate ?? null,
        dateStarted: input.dateStarted ?? null,
        templateId: template?.id ?? null,
        userId,
      },
    })
    return this.get(employee.id)
  }

  async update(id: string, input: UpdateEmployeeInput): Promise<EmployeeDetail> {
    await this.get(id)
    await prisma.employee.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.roleTitle !== undefined && { roleTitle: input.roleTitle }),
        ...(input.onboardingDate !== undefined && { onboardingDate: input.onboardingDate }),
        ...(input.dateStarted !== undefined && { dateStarted: input.dateStarted }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
    })
    return this.get(id)
  }

  async offboard(
    id: string,
    args: { offboardingDate: Date; notes?: string | null },
  ): Promise<EmployeeDetail> {
    await this.get(id)
    await prisma.employee.update({
      where: { id },
      data: {
        status: 'OFFBOARDED',
        offboardingDate: args.offboardingDate,
        ...(args.notes !== undefined && { notes: args.notes }),
      },
    })
    return this.get(id)
  }

  async reactivate(id: string): Promise<EmployeeDetail> {
    await this.get(id)
    await prisma.employee.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        offboardingDate: null,
      },
    })
    return this.get(id)
  }

  async delete(id: string): Promise<void> {
    await this.get(id)
    await prisma.employee.delete({ where: { id } })
  }

  async updateChecklistItem(
    employeeId: string,
    itemId: string,
    args: { status: ChecklistItemStatus; note?: string | null },
  ): Promise<EmployeeDetail> {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, templateId: true },
    })
    if (!employee) throw new Error('Employee not found')

    const item = await prisma.onboardingChecklistItem.findUnique({
      where: { id: itemId },
      select: { id: true, templateId: true },
    })
    if (!item || item.templateId !== employee.templateId) {
      throw new Error('Checklist item not found for this employee')
    }

    const completedAt = args.status === 'OK' ? new Date() : null
    await prisma.employeeChecklistItemStatus.upsert({
      where: { employeeId_itemId: { employeeId, itemId } },
      update: {
        status: args.status,
        completedAt,
        ...(args.note !== undefined && { note: args.note }),
      },
      create: {
        employeeId,
        itemId,
        status: args.status,
        completedAt,
        note: args.note ?? null,
      },
    })

    return this.get(employeeId)
  }
}

export const employeeService = new EmployeeService()

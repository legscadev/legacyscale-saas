import type { ChecklistItemStatus, EmploymentStatus, Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import {
  MemberEmailConflictError,
  provisionMemberWithInvite,
} from '@/lib/services/member-provisioning'
import { memberTenantScope } from '@/lib/tenancy/request-company'

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
  /**
   * Per-item status keyed by item id. Missing entries fall back to
   * PENDING at render time — we never write PENDING rows explicitly
   * to keep the DB sparse.
   */
  statusByItemId: Record<string, ChecklistItemStatus>
}

export interface EmployeeChecklistItem {
  id: string
  label: string
  description: string | null
  orderIndex: number
  status: ChecklistItemStatus
  note: string | null
  completedAt: Date | null
}

export interface EmployeeDetail extends EmployeeListItem {
  notes: string | null
  updatedAt: Date
  /** The global checklist merged with this employee's status rows.
   *  Ordering matches the shared item order (0-based orderIndex). */
  items: EmployeeChecklistItem[]
}

export interface CreateEmployeeInput {
  name: string
  roleTitle: string
  onboardingDate?: Date | null
  dateStarted?: Date | null
  /**
   * When true, the caller also provisions a SaaS account (Supabase
   * auth user + Invite + welcome email) and links it via
   * `Employee.userId`. `email` is required here. Mutually exclusive
   * with `linkUserId`.
   */
  grantAccess?: boolean
  /** SaaS role for the new account. Restricted to ADMIN or TEAM. */
  accessRole?: 'ADMIN' | 'TEAM'
  email?: string
  /**
   * Link the new Employee to an existing User instead of provisioning
   * a fresh account. Mutually exclusive with `grantAccess`. The
   * service verifies the User exists and isn't already linked to
   * another Employee, and does NOT change the user's role or send
   * any email — this is purely a data link.
   */
  linkUserId?: string | null
}

export interface LinkableUser {
  id: string
  email: string
  name: string | null
  role: 'ADMIN' | 'TEAM' | 'MEMBER'
  isAlreadyLinked: boolean
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
 * denominator is the global checklist item count so the ratio stays
 * stable as the admin walks through the list.
 */
function summarize(
  totalItems: number,
  statuses: Array<{ status: ChecklistItemStatus }>,
) {
  // NA rolls into okCount on purpose: "N/A" means the item doesn't
  // apply to this hire, so it should count against the total the
  // same way "Done" does. Otherwise a video editor whose 4 sales
  // items are marked NA would always look 40% complete.
  let okCount = 0
  let pendingCount = 0
  let attentionCount = 0
  for (const s of statuses) {
    if (s.status === 'OK' || s.status === 'NA') okCount++
    else if (s.status === 'PENDING') pendingCount++
    else if (s.status === 'ATTENTION') attentionCount++
  }
  return { totalItems, okCount, pendingCount, attentionCount }
}

class EmployeeService {
  /**
   * Search existing Users by name or email for linking to a new
   * Employee record. Returns up to 8 rows with an
   * `isAlreadyLinked` flag so the UI can dim / disable users who
   * already belong to an Employee (Employee.userId is @unique).
   * Soft-deleted users are excluded.
   */
  async searchLinkableUsers(query: string): Promise<LinkableUser[]> {
    const q = query.trim()
    if (q.length < 1) return []

    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(await memberTenantScope()),
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        employee: { select: { id: true } },
      },
      take: 8,
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    })
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      isAlreadyLinked: u.employee !== null,
    }))
  }

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

    const [employees, totalItems] = await Promise.all([
      prisma.employee.findMany({
        where,
        orderBy: [
          { status: 'asc' },
          { onboardingDate: 'desc' },
          { createdAt: 'desc' },
        ],
        include: {
          checklistStatuses: {
            select: { itemId: true, status: true },
          },
        },
      }),
      prisma.onboardingChecklistItem.count(),
    ])

    return employees.map((e) => {
      const statusByItemId: Record<string, ChecklistItemStatus> = {}
      for (const s of e.checklistStatuses) {
        statusByItemId[s.itemId] = s.status
      }
      return {
        id: e.id,
        name: e.name,
        roleTitle: e.roleTitle,
        status: e.status,
        onboardingDate: e.onboardingDate,
        dateStarted: e.dateStarted,
        offboardingDate: e.offboardingDate,
        createdAt: e.createdAt,
        checklist: summarize(totalItems, e.checklistStatuses),
        statusByItemId,
      }
    })
  }

  async get(id: string): Promise<EmployeeDetail> {
    // Fetch the employee + their status rows and the global item list
    // in parallel. We then merge in-memory so items with no status
    // fall back to PENDING (see comment below).
    const [employee, items] = await Promise.all([
      prisma.employee.findUnique({
        where: { id },
        include: { checklistStatuses: true },
      }),
      prisma.onboardingChecklistItem.findMany({
        orderBy: { orderIndex: 'asc' },
      }),
    ])
    if (!employee) throw new Error('Employee not found')

    const statusByItem = new Map(
      employee.checklistStatuses.map((s) => [s.itemId, s]),
    )

    const merged: EmployeeChecklistItem[] = items.map((item) => {
      const status = statusByItem.get(item.id)
      return {
        id: item.id,
        label: item.label,
        description: item.description,
        orderIndex: item.orderIndex,
        // Missing rows show as PENDING in the UI. It's a cleaner
        // default than NA since new hires almost always start with
        // "nothing done yet".
        status: status?.status ?? ('PENDING' as ChecklistItemStatus),
        note: status?.note ?? null,
        completedAt: status?.completedAt ?? null,
      }
    })

    const statusByItemId: Record<string, ChecklistItemStatus> = {}
    for (const s of employee.checklistStatuses) {
      statusByItemId[s.itemId] = s.status
    }

    return {
      id: employee.id,
      name: employee.name,
      roleTitle: employee.roleTitle,
      status: employee.status,
      onboardingDate: employee.onboardingDate,
      dateStarted: employee.dateStarted,
      offboardingDate: employee.offboardingDate,
      notes: employee.notes,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
      items: merged,
      checklist: summarize(items.length, employee.checklistStatuses),
      statusByItemId,
    }
  }

  async create(input: CreateEmployeeInput): Promise<EmployeeDetail> {
    // Resolve the SaaS account link, if any. Two paths:
    //   1. `linkUserId`   → attach to an existing User (no invite,
    //                       role left as-is). Reject if that User is
    //                       already linked to another Employee.
    //   2. `grantAccess`  → provision a fresh Supabase auth user +
    //                       users row + Invite + welcome email.
    // Both paths run BEFORE inserting the Employee row so any
    // failure (conflict, provisioning error) doesn't leave an
    // orphan HR record behind.
    let userId: string | null = null
    if (input.linkUserId) {
      const target = await prisma.user.findUnique({
        where: { id: input.linkUserId },
        select: {
          id: true,
          email: true,
          deletedAt: true,
          employee: { select: { id: true, name: true } },
        },
      })
      if (!target || target.deletedAt) {
        throw new Error('Selected user could not be found')
      }
      if (target.employee) {
        throw new Error(
          `This user is already linked to another employee: ${target.employee.name}`,
        )
      }
      userId = target.id
    } else if (input.grantAccess) {
      if (!input.email) {
        // The zod schema already enforces this — belt-and-braces for
        // callers that skip validation.
        throw new Error('Email is required to grant system access')
      }
      const member = await provisionMemberWithInvite({
        name: input.name,
        email: input.email,
        role: input.accessRole ?? 'TEAM',
      })
      userId = member.id
    }

    const employee = await prisma.employee.create({
      data: {
        name: input.name,
        roleTitle: input.roleTitle,
        onboardingDate: input.onboardingDate ?? null,
        dateStarted: input.dateStarted ?? null,
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
    const [employee, item] = await Promise.all([
      prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true },
      }),
      prisma.onboardingChecklistItem.findUnique({
        where: { id: itemId },
        select: { id: true },
      }),
    ])
    if (!employee) throw new Error('Employee not found')
    if (!item) throw new Error('Checklist item not found')

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

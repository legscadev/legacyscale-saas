import type { Prisma, Role } from '@prisma/client'

import { prisma } from '@/lib/prisma'

export type MemberStatusFilter = 'active' | 'suspended' | 'archived'
export type MemberSortField = 'name' | 'createdAt' | 'lastLoginAt' | 'lastActiveAt'
export type SortDirection = 'asc' | 'desc'

interface ListMembersOptions {
  search?: string
  /** Single role filter — mutually exclusive with `roles`. */
  role?: Role | null
  /** Multi-role filter — used by the Team page to lump ADMIN + TEAM
   *  under one view. If both `role` and `roles` are set, `role`
   *  wins (single-role is the more specific of the two). */
  roles?: Role[] | null
  status?: MemberStatusFilter | null
  sort?: MemberSortField
  direction?: SortDirection
  page: number
  limit: number
}

const DEFAULT_PAGE_SIZE = 10

function buildWhere(opts: ListMembersOptions): Prisma.UserWhereInput {
  const { search, role, roles, status } = opts

  // The archived view explicitly pulls soft-deleted rows; every other
  // view excludes them.
  const baseWhere: Prisma.UserWhereInput =
    status === 'archived'
      ? { deletedAt: { not: null } }
      : { deletedAt: null }

  const filters: Prisma.UserWhereInput = {}
  if (role) filters.role = role
  else if (roles && roles.length > 0) filters.role = { in: roles }
  if (status === 'active') filters.isActive = true
  if (status === 'suspended') filters.isActive = false

  const searchWhere: Prisma.UserWhereInput | undefined = search?.trim()
    ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ],
      }
    : undefined

  return {
    AND: [baseWhere, filters, ...(searchWhere ? [searchWhere] : [])],
  }
}

function buildOrderBy(
  opts: ListMembersOptions,
): Prisma.UserOrderByWithRelationInput {
  const { sort = 'createdAt', direction = 'desc' } = opts
  if (sort === 'name') return { name: direction }
  if (sort === 'lastLoginAt') return { lastLoginAt: direction }
  if (sort === 'lastActiveAt') return { lastActiveAt: direction }
  return { createdAt: direction }
}

async function listMembers(options: ListMembersOptions) {
  const { page, limit } = options
  const where = buildWhere(options)
  const orderBy = buildOrderBy(options)
  const skip = (page - 1) * limit

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        lastActiveAt: true,
        deletedAt: true,
        categoryId: true,
        category: { select: { id: true, name: true } },
        _count: {
          select: {
            enrollments: {
              where: { status: { in: ['ACTIVE', 'PENDING'] } },
            },
          },
        },
        invites: {
          select: {
            usedAt: true,
            passwordSetAt: true,
            expiresAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    }),
    prisma.user.count({ where }),
  ])

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

/** Returns counts used by the KPI cards in one round trip. When
 *  `roles` is provided (e.g. Team page passes [ADMIN, TEAM]) the
 *  totals scope to just that population so the strip matches the
 *  table under it. Undefined = every user. */
async function getCounts(roles?: Role[]) {
  const scopedActive: Prisma.UserWhereInput = { deletedAt: null }
  const scopedArchived: Prisma.UserWhereInput = { deletedAt: { not: null } }
  if (roles && roles.length > 0) {
    scopedActive.role = { in: roles }
    scopedArchived.role = { in: roles }
  }
  const [groups, archived] = await Promise.all([
    prisma.user.groupBy({
      by: ['role', 'isActive'],
      where: scopedActive,
      _count: { _all: true },
    }),
    prisma.user.count({ where: scopedArchived }),
  ])

  const totals = {
    all: 0,
    admins: 0,
    team: 0,
    members: 0,
    active: 0,
    suspended: 0,
    archived,
  }
  for (const g of groups) {
    const n = g._count._all
    totals.all += n
    if (g.role === 'ADMIN') totals.admins += n
    if (g.role === 'TEAM') totals.team += n
    if (g.role === 'MEMBER') totals.members += n
    if (g.isActive) totals.active += n
    else totals.suspended += n
  }
  return totals
}

/**
 * Returns a 30-element array per user representing daily login counts
 * for the last 30 days. Used to render activity sparklines.
 */
async function getLoginSparklines(
  userIds: string[],
): Promise<Record<string, number[]>> {
  if (userIds.length === 0) return {}

  const rows = await prisma.$queryRaw<
    { user_id: string; day: Date; logins: bigint }[]
  >`
    SELECT user_id, DATE(login_at) as day, COUNT(*) as logins
    FROM login_events
    WHERE user_id = ANY(${userIds})
      AND login_at >= NOW() - INTERVAL '30 days'
    GROUP BY user_id, DATE(login_at)
    ORDER BY user_id, day
  `

  // Build a map of userId → 30-element array (index 0 = 30 days ago)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const result: Record<string, number[]> = {}

  for (const id of userIds) {
    result[id] = Array(30).fill(0)
  }

  for (const row of rows) {
    const arr = result[row.user_id]
    if (!arr) continue
    const dayDate = new Date(row.day)
    dayDate.setHours(0, 0, 0, 0)
    const diffDays = Math.round((today.getTime() - dayDate.getTime()) / (1000 * 60 * 60 * 24))
    const index = 29 - diffDays
    if (index >= 0 && index < 30) {
      arr[index] = Number(row.logins)
    }
  }

  return result
}

export const memberService = {
  list: listMembers,
  counts: getCounts,
  sparklines: getLoginSparklines,
  defaultPageSize: DEFAULT_PAGE_SIZE,
}

export type MemberListItem = Awaited<
  ReturnType<typeof listMembers>
>['items'][number]
export type MemberCounts = Awaited<ReturnType<typeof getCounts>>

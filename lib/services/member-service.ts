import type { Prisma, Role } from '@prisma/client'

import { prisma } from '@/lib/prisma'

export type MemberTab = 'all' | 'admins' | 'members' | 'suspended' | 'archived'
export type MemberSortField = 'name' | 'createdAt' | 'lastLoginAt'
export type SortDirection = 'asc' | 'desc'

interface ListMembersOptions {
  tab?: MemberTab
  search?: string
  role?: Role | null
  /** null = any status; 'active' or 'suspended' map to isActive boolean. */
  status?: 'active' | 'suspended' | null
  sort?: MemberSortField
  direction?: SortDirection
  page: number
  limit: number
}

const DEFAULT_PAGE_SIZE = 20

function buildWhere(opts: ListMembersOptions): Prisma.UserWhereInput {
  const { tab = 'all', search, role, status } = opts

  // Archived tab pulls soft-deleted rows; every other tab excludes them.
  const tabWhere: Prisma.UserWhereInput =
    tab === 'archived'
      ? { deletedAt: { not: null } }
      : tab === 'admins'
        ? { deletedAt: null, role: 'ADMIN' }
        : tab === 'members'
          ? { deletedAt: null, role: 'MEMBER' }
          : tab === 'suspended'
            ? { deletedAt: null, isActive: false }
            : { deletedAt: null }

  const filters: Prisma.UserWhereInput = {}
  if (role) filters.role = role
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
    AND: [tabWhere, filters, ...(searchWhere ? [searchWhere] : [])],
  }
}

function buildOrderBy(
  opts: ListMembersOptions,
): Prisma.UserOrderByWithRelationInput {
  const { sort = 'createdAt', direction = 'desc' } = opts
  if (sort === 'name') return { name: direction }
  if (sort === 'lastLoginAt') return { lastLoginAt: direction }
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
        deletedAt: true,
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

/**
 * Returns counts used by the tab bar + KPI cards in one round trip.
 * Group-by gives us role + isActive splits for active users; a separate
 * count covers the soft-deleted (archived) bucket.
 */
async function getCounts() {
  const [groups, archived] = await Promise.all([
    prisma.user.groupBy({
      by: ['role', 'isActive'],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.user.count({ where: { deletedAt: { not: null } } }),
  ])

  const totals = {
    all: 0,
    admins: 0,
    members: 0,
    active: 0,
    suspended: 0,
    archived,
  }
  for (const g of groups) {
    const n = g._count._all
    totals.all += n
    if (g.role === 'ADMIN') totals.admins += n
    if (g.role === 'MEMBER') totals.members += n
    if (g.isActive) totals.active += n
    else totals.suspended += n
  }
  return totals
}

export const memberService = {
  list: listMembers,
  counts: getCounts,
  defaultPageSize: DEFAULT_PAGE_SIZE,
}

export type MemberListItem = Awaited<
  ReturnType<typeof listMembers>
>['items'][number]
export type MemberCounts = Awaited<ReturnType<typeof getCounts>>

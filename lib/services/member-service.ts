import { prisma } from '@/lib/prisma'

interface ListMembersOptions {
  page: number
  limit: number
}

const DEFAULT_PAGE_SIZE = 20

/**
 * Returns active (non-soft-deleted) users paginated by creation order
 * (newest first). Includes both ADMIN and MEMBER roles so the admin
 * can see their own row in the table.
 */
async function listMembers(options: ListMembersOptions) {
  const { page, limit } = options
  const skip = (page - 1) * limit

  const where = { deletedAt: null }

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
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

export const memberService = {
  list: listMembers,
  defaultPageSize: DEFAULT_PAGE_SIZE,
}

export type MemberListItem = Awaited<
  ReturnType<typeof listMembers>
>['items'][number]

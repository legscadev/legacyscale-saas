'use server'

import type { Role } from '@prisma/client'

import { requireAdmin } from '@/lib/auth/get-user'
import {
  memberService,
  type MemberCounts,
  type MemberListItem,
  type MemberSortField,
  type MemberStatusFilter,
  type SortDirection,
} from '@/lib/services/member-service'

export interface MembersQueryState {
  search: string
  role: Role | null
  /** When the page hard-locks a set of roles (e.g. Team page →
   *  ADMIN + TEAM), this is set. Ignored when the user picks a
   *  single role via the toolbar. */
  roles?: Role[] | null
  status: MemberStatusFilter | null
  sort: MemberSortField
  direction: SortDirection
  page: number
}

export interface MembersData {
  counts: MemberCounts
  items: MemberListItem[]
  total: number
  page: number
  limit: number
  totalPages: number
  sparklines: Record<string, number[]>
}

export async function fetchMembers(
  state: MembersQueryState,
): Promise<MembersData> {
  await requireAdmin()

  // Scope the KPI strip to the same population the table shows.
  // Single-role picks (from the toolbar) narrow further; the
  // locked-roles set (Team page) wins if the toolbar isn't in play.
  const countRoles: Role[] | undefined = state.role
    ? [state.role]
    : state.roles ?? undefined
  const [counts, result] = await Promise.all([
    memberService.counts(countRoles),
    memberService.list({
      search: state.search || undefined,
      role: state.role,
      roles: state.roles ?? null,
      status: state.status,
      sort: state.sort,
      direction: state.direction,
      page: state.page,
      limit: memberService.defaultPageSize,
    }),
  ])

  const sparklines = await memberService.sparklines(
    result.items.map((m) => m.id),
  )

  return {
    counts,
    items: result.items,
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
    sparklines,
  }
}

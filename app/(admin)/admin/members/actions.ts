'use server'

import type { Role } from '@prisma/client'

import { requireAdmin } from '@/lib/auth/get-user'
import {
  memberService,
  type MemberCounts,
  type MemberListItem,
  type MemberSortField,
  type MemberTab,
  type SortDirection,
} from '@/lib/services/member-service'

export interface MembersQueryState {
  tab: MemberTab
  search: string
  role: Role | null
  status: 'active' | 'suspended' | null
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
}

export async function fetchMembers(
  state: MembersQueryState,
): Promise<MembersData> {
  await requireAdmin()

  const [counts, result] = await Promise.all([
    memberService.counts(),
    memberService.list({
      tab: state.tab,
      search: state.search || undefined,
      role: state.role,
      status: state.status,
      sort: state.sort,
      direction: state.direction,
      page: state.page,
      limit: memberService.defaultPageSize,
    }),
  ])

  return {
    counts,
    items: result.items,
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  }
}

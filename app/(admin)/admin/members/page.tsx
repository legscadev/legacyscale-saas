import { Plus, Users } from 'lucide-react'
import type { Role } from '@prisma/client'

import { Button } from '@/components/ui/button'
import { PageHeader, EmptyState } from '@/components/shared'
import { MembersMetrics } from '@/components/admin/members/members-metrics'
import { MembersTabs } from '@/components/admin/members/members-tabs'
import { MembersToolbar } from '@/components/admin/members/members-toolbar'
import { MembersTable } from '@/components/admin/members/members-table'
import { MembersPagination } from '@/components/admin/members/members-pagination'
import { requireAdmin } from '@/lib/auth/get-user'
import {
  memberService,
  type MemberSortField,
  type MemberTab,
  type SortDirection,
} from '@/lib/services/member-service'

interface AdminMembersPageProps {
  searchParams: Promise<{
    tab?: string
    q?: string
    role?: string
    status?: string
    sort?: string
    direction?: string
    page?: string
  }>
}

function parsePage(raw: string | undefined): number {
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

const VALID_TABS: MemberTab[] = [
  'all',
  'admins',
  'members',
  'suspended',
  'archived',
]
const VALID_SORTS: MemberSortField[] = ['name', 'createdAt', 'lastLoginAt']
const VALID_DIRECTIONS: SortDirection[] = ['asc', 'desc']
const VALID_ROLES: Role[] = ['ADMIN', 'MEMBER']

function pickEnum<T extends string>(value: string | undefined, allowed: T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined
}

export default async function AdminMembersPage({
  searchParams,
}: AdminMembersPageProps) {
  const [admin, raw] = await Promise.all([requireAdmin(), searchParams])

  const tab = pickEnum(raw.tab, VALID_TABS) ?? 'all'
  const sort = pickEnum(raw.sort, VALID_SORTS) ?? 'createdAt'
  const direction = pickEnum(raw.direction, VALID_DIRECTIONS) ?? 'desc'
  const role = pickEnum(raw.role, VALID_ROLES) ?? null
  const status =
    raw.status === 'active'
      ? ('active' as const)
      : raw.status === 'suspended'
        ? ('suspended' as const)
        : null
  const page = parsePage(raw.page)

  const [counts, result] = await Promise.all([
    memberService.counts(),
    memberService.list({
      tab,
      search: raw.q,
      role,
      status,
      sort,
      direction,
      page,
      limit: memberService.defaultPageSize,
    }),
  ])

  const hasFilters =
    Boolean(raw.q?.trim()) || role !== null || status !== null
  const showEmpty = result.items.length === 0
  const onlyAdminInPlatform = counts.all <= 1

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members"
        description={`Manage ${counts.all.toLocaleString()} ${
          counts.all === 1 ? 'person' : 'people'
        } across your platform.`}
        actions={
          <Button disabled>
            <Plus className="size-4" />
            Add member
          </Button>
        }
      />

      <MembersMetrics counts={counts} />

      <div className="space-y-4">
        <MembersTabs active={tab} counts={counts} />
        <MembersToolbar />

        {showEmpty ? (
          <EmptyState
            icon={Users}
            title={
              hasFilters
                ? 'No members match these filters'
                : onlyAdminInPlatform
                  ? 'No members yet'
                  : 'Nothing in this tab'
            }
            description={
              hasFilters
                ? 'Try widening your search or clearing filters.'
                : onlyAdminInPlatform
                  ? "Add your first member to get started — they'll show up here once created."
                  : 'Members will appear here when they match this tab.'
            }
          />
        ) : (
          <>
            <MembersTable
              members={result.items}
              currentUserId={admin.id}
            />
            <MembersPagination
              page={result.page}
              totalPages={result.totalPages}
              total={result.total}
              limit={result.limit}
            />
          </>
        )}
      </div>
    </div>
  )
}

import { Plus, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { PageHeader, EmptyState } from '@/components/shared'
import { MembersTable } from '@/components/admin/members/members-table'
import { MembersPagination } from '@/components/admin/members/members-pagination'
import { requireAdmin } from '@/lib/auth/get-user'
import { memberService } from '@/lib/services/member-service'

interface AdminMembersPageProps {
  searchParams: Promise<{ page?: string }>
}

function parsePage(raw: string | undefined): number {
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

export default async function AdminMembersPage({
  searchParams,
}: AdminMembersPageProps) {
  const [admin, { page: pageParam }] = await Promise.all([
    requireAdmin(),
    searchParams,
  ])

  const page = parsePage(pageParam)
  const result = await memberService.list({
    page,
    limit: memberService.defaultPageSize,
  })

  const onlyAdminExists = result.total <= 1

  return (
    <div className="space-y-6">
      <PageHeader title="Members" description="Manage platform members">
        <Button disabled>
          <Plus className="size-4" />
          Add Member
        </Button>
      </PageHeader>

      {onlyAdminExists ? (
        <EmptyState
          icon={Users}
          title="No members yet"
          description="Add your first member to get started — they'll show up here once created."
        />
      ) : (
        <>
          <MembersTable members={result.items} currentUserId={admin.id} />
          <MembersPagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            limit={result.limit}
          />
        </>
      )}
    </div>
  )
}

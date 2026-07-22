import { requireAdmin } from '@/lib/auth/get-user'
import { membershipService } from '@/lib/services/membership-service'
import { MembersShell } from '@/components/admin/members/members-shell'
import { fetchMembers } from './actions'

export default async function AdminMembersPage() {
  const admin = await requireAdmin()
  // Members lives under Community in the sidebar → default to
  // students only. Ruby can still switch the role filter in the
  // toolbar to see staff if she needs to.
  const [initialData, membershipsRaw] = await Promise.all([
    fetchMembers({
      search: '',
      role: 'MEMBER',
      status: null,
      sort: 'createdAt',
      direction: 'desc',
      page: 1,
    }),
    membershipService.list(),
  ])

  const memberships = membershipsRaw.map((m) => ({ id: m.id, name: m.name }))

  return (
    <MembersShell
      currentUserId={admin.id}
      initialData={initialData}
      memberships={memberships}
      defaultRole="MEMBER"
    />
  )
}

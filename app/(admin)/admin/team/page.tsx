import { requireAdmin } from '@/lib/auth/get-user'
import { membershipService } from '@/lib/services/membership-service'
import { MembersShell } from '@/components/admin/members/members-shell'
import { fetchMembers } from '../members/actions'

export default async function AdminTeamPage() {
  const admin = await requireAdmin()
  // Team lens: ADMIN + TEAM only. Memberships still load so the
  // shared MembersShell renders correctly, even though membership
  // assignment is a student concept (staff rows have no badge).
  const [initialData, membershipsRaw] = await Promise.all([
    fetchMembers({
      search: '',
      role: null,
      roles: ['ADMIN', 'TEAM'],
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
      lockedRoles={['ADMIN', 'TEAM']}
      pageTitle="Team"
      pageDescription="Admins, staff, and everyone with a role behind the scenes."
    />
  )
}

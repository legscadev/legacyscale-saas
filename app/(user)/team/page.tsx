import { redirect } from 'next/navigation'

import { requireTeamModuleAccess } from '@/lib/auth/get-user'
import { membershipService } from '@/lib/services/membership-service'
import { MembersShell } from '@/components/admin/members/members-shell'
import { fetchMembers } from '@/app/(admin)/admin/members/actions'

// /team is the staff roster — the natural landing page for the
// TEAM namespace. ADMIN gets bounced to /admin/team where they
// also have manage-access + member-CRUD.
//
// Write server actions (add member, suspend, archive, grant
// access) stay ADMIN-only, so TEAM sees the roster with those
// buttons visible but non-functional. The user accepted that
// tradeoff — no read-only refactor.

export default async function TeamRosterPage() {
  const viewer = await requireTeamModuleAccess('team')
  if (viewer.role === 'ADMIN') redirect('/admin/team')

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
      currentUserId={viewer.id}
      initialData={initialData}
      memberships={memberships}
      lockedRoles={['ADMIN', 'TEAM']}
      pageTitle="Team"
      pageDescription="Admins, staff, and everyone with a role behind the scenes."
    />
  )
}

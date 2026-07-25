import { requireTeamModuleAccess } from '@/lib/auth/get-user'
import { membershipService } from '@/lib/services/membership-service'
import { MembersShell } from '@/components/admin/members/members-shell'
import { fetchMembers } from './actions'

export default async function AdminStudentsPage() {
  const admin = await requireTeamModuleAccess('students')
  // Students lives under Community in the sidebar → default to
  // students only (User.role = MEMBER). Admins can flip the role
  // filter in the toolbar to see staff if needed.
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
      pageTitle="Students"
      pageDescription="Learners enrolled in your courses — enrollments, invites, and access."
    />
  )
}

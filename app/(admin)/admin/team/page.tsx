import { requireTeamModuleAccess } from '@/lib/auth/get-user'
import { categoryService } from '@/lib/services/category-service'
import { MembersShell } from '@/components/admin/members/members-shell'
import { fetchMembers } from '../members/actions'

export default async function AdminTeamPage() {
  const admin = await requireTeamModuleAccess('team')
  // Team lens: ADMIN + TEAM only. Categories still load so the shared
  // MembersShell renders correctly, even though category assignment
  // is a student concept (staff rows have no category badge).
  const [initialData, categoriesRaw] = await Promise.all([
    fetchMembers({
      search: '',
      role: null,
      roles: ['ADMIN', 'TEAM'],
      status: null,
      sort: 'createdAt',
      direction: 'desc',
      page: 1,
    }),
    categoryService.list(),
  ])

  const categories = categoriesRaw.map((c) => ({ id: c.id, name: c.name }))

  return (
    <MembersShell
      currentUserId={admin.id}
      initialData={initialData}
      categories={categories}
      lockedRoles={['ADMIN', 'TEAM']}
      pageTitle="Team"
      pageDescription="Admins, staff, and everyone with a role behind the scenes."
    />
  )
}

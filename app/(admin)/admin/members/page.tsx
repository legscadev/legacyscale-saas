import { requireAdmin } from '@/lib/auth/get-user'
import { categoryService } from '@/lib/services/category-service'
import { MembersShell } from '@/components/admin/members/members-shell'
import { fetchMembers } from './actions'

export default async function AdminMembersPage() {
  const admin = await requireAdmin()
  const [initialData, categoriesRaw] = await Promise.all([
    fetchMembers({
      search: '',
      role: null,
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
    />
  )
}

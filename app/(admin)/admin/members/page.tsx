import { requireAdmin } from '@/lib/auth/get-user'
import { MembersShell } from '@/components/admin/members/members-shell'
import { fetchMembers } from './actions'

export default async function AdminMembersPage() {
  const admin = await requireAdmin()
  const initialData = await fetchMembers({
    tab: 'all',
    search: '',
    role: null,
    status: null,
    sort: 'createdAt',
    direction: 'desc',
    page: 1,
  })

  return <MembersShell currentUserId={admin.id} initialData={initialData} />
}

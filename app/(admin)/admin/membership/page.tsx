import { requireAdmin } from '@/lib/auth/get-user'
import { MembershipsShell } from '@/components/admin/membership/memberships-shell'
import { fetchMemberships } from './actions'

export default async function AdminMembershipPage() {
  await requireAdmin()
  const initialData = await fetchMemberships()

  return <MembershipsShell initialData={initialData} />
}

import {  requireTeamModuleAccess  } from "@/lib/auth/get-user"
import { MembershipsShell } from '@/components/admin/membership/memberships-shell'
import { fetchMemberships } from './actions'

export default async function AdminMembershipPage() {
  await requireTeamModuleAccess("membership")
  const initialData = await fetchMemberships()

  return <MembershipsShell initialData={initialData} />
}

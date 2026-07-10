import { PageHeader } from '@/components/shared/page-header'
import { SuperAdminsShell } from '@/components/super/super-admins/super-admins-shell'

import { fetchSuperAdmins } from './actions'

export const dynamic = 'force-dynamic'

export default async function SuperAdminsPage() {
  const initialRows = await fetchSuperAdmins()

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Super admins"
        description="Everyone who holds the master key. Grant the flag to add a super-admin; revoke to take it away. You cannot revoke the last one — grant a replacement first."
      />
      <SuperAdminsShell initialRows={initialRows} />
    </div>
  )
}

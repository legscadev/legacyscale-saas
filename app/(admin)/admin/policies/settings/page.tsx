import { requireAdmin } from '@/lib/auth/get-user'
import { PolicySettingsShell } from '@/components/admin/policies/policy-settings-shell'
import { ensurePolicyWorkspaceReady } from '@/lib/services/policy-workspace-service'
import { getRequestCompanyId } from '@/lib/tenancy/request-company'

import { fetchPolicySettingsAction } from './actions'

export const dynamic = 'force-dynamic'

export default async function AdminPolicySettingsPage() {
  await requireAdmin()
  const companyId = await getRequestCompanyId()
  if (companyId) await ensurePolicyWorkspaceReady(companyId)

  const res = await fetchPolicySettingsAction()
  if (!res.ok) {
    throw new Error(res.error ?? 'Could not load policy settings')
  }
  return <PolicySettingsShell initialData={res.data} />
}

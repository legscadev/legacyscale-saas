import { requireTeamModuleAccess } from '@/lib/auth/get-user'
import { WorkflowSettingsShell } from '@/components/admin/tasks/workflow-settings-shell'
import { ensureWorkflowReady } from '@/lib/services/task-workflow-service'
import { getRequestCompanyId } from '@/lib/tenancy/request-company'

import { fetchWorkflowSettingsAction } from './actions'

export const dynamic = 'force-dynamic'

export default async function AdminTaskWorkflowSettingsPage() {
  // Open to any user who can access the tracker itself. TEAM users
  // with the 'tasks' grant configure their own workflow (statuses,
  // categories, labels) alongside admins.
  await requireTeamModuleAccess('tasks')
  const companyId = await getRequestCompanyId()
  if (companyId) await ensureWorkflowReady(companyId)

  const res = await fetchWorkflowSettingsAction()
  if (!res.ok) {
    throw new Error(res.error ?? 'Could not load workflow settings')
  }
  return <WorkflowSettingsShell initialData={res.data} />
}

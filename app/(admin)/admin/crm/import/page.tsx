import { redirect } from 'next/navigation'

import { requireTeamOrAdmin } from '@/lib/auth/get-user'
import { ImportWizard } from '@/components/admin/crm/import-wizard'
import { listAssignableSalesUsers } from '@/lib/services/crm-assignable-users'
import { memberTenantScope } from '@/lib/tenancy/request-company'
import { fetchPipelineWorkspaceAction } from '@/app/(admin)/admin/crm/opportunities/actions'
import { fetchLeadsWorkspaceAction } from '@/app/(admin)/admin/crm/leads/actions'

// GHL-style unified importer. Serves both /admin/crm/leads (Contacts)
// and /admin/crm/opportunities import buttons via a 4-step wizard
// (Start → Upload → Map → Verify). Auth is admin-only for P0 — the
// team surface doesn't need the importer.

export const dynamic = 'force-dynamic'

interface ImportPageProps {
  searchParams: Promise<{ object?: string }>
}

export default async function AdminImportPage({
  searchParams,
}: ImportPageProps) {
  const viewer = await requireTeamOrAdmin()
  if (viewer.role !== 'ADMIN') redirect('/team/crm/leads')

  const params = await searchParams
  const preselectedObject =
    params.object === 'opportunities' ? 'opportunities' : 'contacts'

  // Pull the workspace payloads for both objects — the wizard needs
  // pipelines/stages (Opportunities) to render its dropdowns without
  // a client round-trip after every step. Members are fetched
  // separately in strict mode below so the import assignee picker
  // only offers real setter/closer users regardless of tenant state.
  const [oppRes, leadRes, strictMembers] = await Promise.all([
    fetchPipelineWorkspaceAction(),
    fetchLeadsWorkspaceAction(),
    (async () => listAssignableSalesUsers(await memberTenantScope(), {
      strict: true,
    }))(),
  ])
  if (!oppRes.ok) throw new Error(oppRes.error ?? 'Could not load pipelines')
  if (!leadRes.ok) throw new Error(leadRes.error ?? 'Could not load contacts')

  return (
    <ImportWizard
      preselectedObject={preselectedObject}
      pipelines={oppRes.data.pipelines}
      contactMembers={strictMembers}
      opportunityMembers={strictMembers}
    />
  )
}

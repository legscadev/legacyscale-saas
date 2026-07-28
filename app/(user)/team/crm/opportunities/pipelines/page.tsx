import { redirect } from 'next/navigation'

import { PageHeader } from '@/components/shared/page-header'
import { requireTeamModuleAccess } from '@/lib/auth/get-user'

import { fetchPipelinesForManagementAction } from '@/app/(admin)/admin/crm/opportunities/actions'
import { OpportunitiesTabs } from '@/components/admin/crm/opportunities-tabs'
import { PipelinesTable } from '@/components/admin/crm/pipelines-table'

// Team surface for the Pipelines management tab. Mirrors the admin
// page — same fetcher, same table — under a /team/* URL so staff
// URLs stay separate. ADMIN gets bounced to the admin surface.

export const dynamic = 'force-dynamic'

export default async function TeamPipelinesPage() {
  const viewer = await requireTeamModuleAccess('crm-pipeline')
  if (viewer.role === 'ADMIN') redirect('/admin/crm/opportunities/pipelines')

  const result = await fetchPipelinesForManagementAction()
  if (!result.ok) {
    throw new Error(result.error ?? 'Could not load pipelines')
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Opportunities"
        description="Track pipelines and sales progress across stages."
      />
      <OpportunitiesTabs basePath="/team/crm/opportunities" />
      <PipelinesTable
        initialPipelines={result.data}
        boardBasePath="/team/crm/opportunities"
      />
    </div>
  )
}

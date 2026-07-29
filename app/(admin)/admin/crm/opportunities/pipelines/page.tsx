import { redirect } from 'next/navigation'

import { PageHeader } from '@/components/shared/page-header'
import { requireTeamOrAdmin } from '@/lib/auth/get-user'

import { fetchPipelinesForManagementAction } from '../actions'
import { OpportunitiesTabs } from '@/components/admin/crm/opportunities-tabs'
import { PipelinesTable } from '@/components/admin/crm/pipelines-table'

// Admin surface for the Pipelines management tab. Lists every pipeline
// in the tenant with stage count + last-updated stamp; supports
// drag-reorder, per-row rename / manage-stages / delete, and creating
// new pipelines. Team users have their own mirror at
// /team/crm/opportunities/pipelines.

export const dynamic = 'force-dynamic'

export default async function AdminPipelinesPage() {
  const viewer = await requireTeamOrAdmin()
  if (viewer.role !== 'ADMIN') {
    redirect('/team/crm/opportunities/pipelines')
  }

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
      <OpportunitiesTabs basePath="/admin/crm/opportunities" />
      <PipelinesTable
        initialPipelines={result.data}
        boardBasePath="/admin/crm/opportunities"
      />
    </div>
  )
}

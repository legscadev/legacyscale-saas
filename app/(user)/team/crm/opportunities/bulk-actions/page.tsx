import { redirect } from 'next/navigation'

import { PageHeader } from '@/components/shared/page-header'
import { requireTeamModuleAccess } from '@/lib/auth/get-user'

import { fetchBulkActionsHistoryAction } from '@/app/(admin)/admin/crm/opportunities/actions'
import { BulkActionsTable } from '@/components/admin/crm/bulk-actions-table'
import { OpportunitiesTabs } from '@/components/admin/crm/opportunities-tabs'

// Team surface for the Bulk Actions history log. Mirrors the admin
// page — same fetcher, same table — under a /team/* URL.

export const dynamic = 'force-dynamic'

export default async function TeamBulkActionsPage() {
  const viewer = await requireTeamModuleAccess('crm-pipeline')
  if (viewer.role === 'ADMIN') {
    redirect('/admin/crm/opportunities/bulk-actions')
  }

  const result = await fetchBulkActionsHistoryAction({})
  if (!result.ok) {
    throw new Error(result.error ?? 'Could not load bulk action history')
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Opportunities"
        description="Track bulk actions and jobs run against the pipeline."
      />
      <OpportunitiesTabs basePath="/team/crm/opportunities" />
      <BulkActionsTable
        rows={result.data.rows}
        total={result.data.total}
        page={result.data.page}
        limit={result.data.limit}
      />
    </div>
  )
}

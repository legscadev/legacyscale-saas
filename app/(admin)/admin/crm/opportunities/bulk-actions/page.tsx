import { redirect } from 'next/navigation'

import { PageHeader } from '@/components/shared/page-header'
import { requireTeamOrAdmin } from '@/lib/auth/get-user'

import { fetchBulkActionsHistoryAction } from '../actions'
import { BulkActionsTable } from '@/components/admin/crm/bulk-actions-table'
import { OpportunitiesTabs } from '@/components/admin/crm/opportunities-tabs'

// Admin surface for the Bulk Actions history log. Read-only view of
// every bulk job the pipeline board dispatched — who ran it, when,
// how many rows it touched. Team users have their own mirror at
// /team/crm/opportunities/bulk-actions.

export const dynamic = 'force-dynamic'

export default async function AdminBulkActionsPage() {
  const viewer = await requireTeamOrAdmin()
  if (viewer.role !== 'ADMIN') {
    redirect('/team/crm/opportunities/bulk-actions')
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
      <OpportunitiesTabs basePath="/admin/crm/opportunities" />
      <BulkActionsTable
        rows={result.data.rows}
        total={result.data.total}
        page={result.data.page}
        limit={result.data.limit}
      />
    </div>
  )
}

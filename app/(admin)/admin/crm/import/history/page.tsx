import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { requireTeamOrAdmin } from '@/lib/auth/get-user'
import { ImportHistoryTable } from '@/components/admin/crm/import-history-table'
import { crmImportJobService } from '@/lib/services/crm-import-job-service'

// Log of previous import wizard runs for the current admin. Kept
// per-actor for P0 (matches Smart Lists' privacy model) — a later
// phase can flip this to tenant-wide once we add a shared toggle.

export const dynamic = 'force-dynamic'

export default async function AdminImportHistoryPage() {
  const viewer = await requireTeamOrAdmin()
  if (viewer.role !== 'ADMIN') redirect('/team/crm/leads')

  const jobs = await crmImportJobService.list(viewer.id)

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Previous imports
          </h1>
          <p className="text-sm text-muted-foreground">
            Every CSV import you've run through the wizard. Kept for
            audit + retry.
          </p>
        </div>
        <Link
          href="/admin/crm/import"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-transparent px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
        >
          <ArrowLeft className="size-3.5" />
          Back to import
        </Link>
      </header>

      <ImportHistoryTable jobs={jobs} />
    </div>
  )
}

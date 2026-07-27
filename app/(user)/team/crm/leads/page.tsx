import { redirect } from 'next/navigation'

import { requireTeamModuleAccess } from '@/lib/auth/get-user'
import { LeadsShell } from '@/components/admin/crm/leads-shell'
import { fetchLeadsWorkspaceAction } from '@/app/(admin)/admin/crm/leads/actions'

// TEAM (setter) surface for the lead inbox. Mirrors /admin/crm/leads
// but pins the "mine" filter so a setter sees the leads routed to
// them. ADMIN is bounced to the admin surface.

export const dynamic = 'force-dynamic'

function parseFilters(
  raw: Record<string, string | string[] | undefined>,
): Record<string, unknown> {
  const scalar = (v: string | string[] | undefined) =>
    v === undefined ? undefined : Array.isArray(v) ? v[0] : v
  return {
    search: scalar(raw.q),
    statuses: scalar(raw.status) ? [scalar(raw.status)] : undefined,
    sources: scalar(raw.source) ? [scalar(raw.source)] : undefined,
    // Team surface always scopes to the viewer's own leads.
    mine: true,
    sortBy: scalar(raw.sort),
    sortOrder: scalar(raw.dir),
    page: scalar(raw.page),
  }
}

interface TeamLeadsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function TeamLeadsPage({
  searchParams,
}: TeamLeadsPageProps) {
  const viewer = await requireTeamModuleAccess('crm-leads')
  if (viewer.role === 'ADMIN') redirect('/admin/crm/leads')

  const raw = await searchParams
  const result = await fetchLeadsWorkspaceAction(parseFilters(raw))
  if (!result.ok) {
    if (result.fieldErrors) redirect('/team/crm/leads')
    throw new Error(result.error ?? 'Could not load leads')
  }

  return (
    <LeadsShell
      initialData={result.data}
      basePath="/team/crm/leads"
      teamSurface
    />
  )
}

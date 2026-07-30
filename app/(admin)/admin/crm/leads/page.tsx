import { redirect } from 'next/navigation'

import { requireTeamOrAdmin } from '@/lib/auth/get-user'
import { LeadsShell } from '@/components/admin/crm/leads-shell'

import { fetchLeadsWorkspaceAction } from './actions'

// Admin surface for the lead inbox. TEAM users are bounced to
// /team/crm/leads with params intact. ADMIN sees every lead.

export const dynamic = 'force-dynamic'

function parseFilters(
  raw: Record<string, string | string[] | undefined>,
): Record<string, unknown> {
  const scalar = (v: string | string[] | undefined) =>
    v === undefined ? undefined : Array.isArray(v) ? v[0] : v
  const csvList = (v: string | undefined): string[] | undefined =>
    v ? v.split(',').filter(Boolean) : undefined
  const bool = (v: string | undefined): boolean | undefined => {
    if (v === '1' || v === 'true') return true
    if (v === '0' || v === 'false') return false
    return undefined
  }
  return {
    search: scalar(raw.q),
    // Support both `?status=NEW` (legacy single) and `?statuses=NEW,CONTACTED`
    // (drawer chip toggles).
    statuses:
      csvList(scalar(raw.statuses)) ??
      (scalar(raw.status) ? [scalar(raw.status)] : undefined),
    sources:
      csvList(scalar(raw.sources)) ??
      (scalar(raw.source) ? [scalar(raw.source)] : undefined),
    assigneeIds: csvList(scalar(raw.assignees)),
    mine: scalar(raw.mine) === '1',
    hasEmail: bool(scalar(raw.has_email)),
    hasPhone: bool(scalar(raw.has_phone)),
    companyName: scalar(raw.company),
    createdFrom: scalar(raw.created_from),
    createdTo: scalar(raw.created_to),
    lastActivityFrom: scalar(raw.activity_from),
    lastActivityTo: scalar(raw.activity_to),
    sortBy: scalar(raw.sort),
    sortOrder: scalar(raw.dir),
    page: scalar(raw.page),
    limit: scalar(raw.per_page),
  }
}

interface AdminLeadsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AdminLeadsPage({
  searchParams,
}: AdminLeadsPageProps) {
  const viewer = await requireTeamOrAdmin()
  const raw = await searchParams
  if (viewer.role !== 'ADMIN') {
    const qs = new URLSearchParams()
    for (const [key, value] of Object.entries(raw)) {
      if (value === undefined) continue
      if (Array.isArray(value)) value.forEach((v) => qs.append(key, v))
      else qs.set(key, value)
    }
    const suffix = qs.toString()
    redirect(suffix ? `/team/crm/leads?${suffix}` : '/team/crm/leads')
  }

  const result = await fetchLeadsWorkspaceAction(parseFilters(raw))
  if (!result.ok) {
    if (result.fieldErrors) redirect('/admin/crm/leads')
    throw new Error(result.error ?? 'Could not load leads')
  }

  return <LeadsShell initialData={result.data} basePath="/admin/crm/leads" />
}

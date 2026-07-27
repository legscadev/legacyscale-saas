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
  return {
    search: scalar(raw.q),
    statuses: scalar(raw.status) ? [scalar(raw.status)] : undefined,
    sources: scalar(raw.source) ? [scalar(raw.source)] : undefined,
    mine: scalar(raw.mine) === '1',
    sortBy: scalar(raw.sort),
    sortOrder: scalar(raw.dir),
    page: scalar(raw.page),
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

import { redirect } from 'next/navigation'

import { fetchPolicyWorkspaceAction } from '@/app/(admin)/admin/policies/actions'
import { PoliciesShell } from '@/components/admin/policies/policies-shell'
import { requireTeamOrAdmin } from '@/lib/auth'

// Same filter-param mapping as /admin/policies — the shell + action
// consume the same shape, so we route both surfaces through the
// same parser.
function parseFiltersFromSearchParams(
  raw: Record<string, string | string[] | undefined>,
): Record<string, unknown> {
  const arr = (v: string | string[] | undefined) =>
    v === undefined ? undefined : Array.isArray(v) ? v : v.split(',')
  const scalar = (v: string | string[] | undefined) =>
    v === undefined ? undefined : Array.isArray(v) ? v[0] : v

  return {
    search: scalar(raw.q),
    statuses: arr(raw.status),
    categoryIds: arr(raw.category),
    // TEAM read view never surfaces archived policies — no toggle
    // in the filter bar and the request never opts in.
    includeArchived: false,
    sortBy: scalar(raw.sort),
    sortOrder: scalar(raw.dir),
    page: scalar(raw.page),
    limit: scalar(raw.limit),
  }
}

export const dynamic = 'force-dynamic'

interface MemberPoliciesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function MemberPoliciesPage({
  searchParams,
}: MemberPoliciesPageProps) {
  const user = await requireTeamOrAdmin()

  // Admins get bounced to /admin/policies so they see write
  // affordances — the confusing "read view with edit buttons"
  // state isn't worth supporting.
  if (user.role === 'ADMIN') {
    redirect('/admin/policies')
  }

  const raw = await searchParams
  const filters = parseFiltersFromSearchParams(raw)

  const result = await fetchPolicyWorkspaceAction(filters)
  if (!result.ok) {
    if (result.fieldErrors) redirect('/policies')
    throw new Error(result.error ?? 'Could not load policies')
  }

  return <PoliciesShell initialData={result.data} />
}

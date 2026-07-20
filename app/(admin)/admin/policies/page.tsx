import { redirect } from 'next/navigation'

import { requireAdmin } from '@/lib/auth/get-user'
import { PoliciesShell } from '@/components/admin/policies/policies-shell'

import { fetchPolicyWorkspaceAction } from './actions'

// Parses raw ?q=&category=&status=... into the shape
// policyFilterSchema expects (arrays for multi-select facets).
// Left permissive — Zod does the actual validation on the server.
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
    includeArchived: scalar(raw.archived) === '1',
    sortBy: scalar(raw.sort),
    sortOrder: scalar(raw.dir),
    page: scalar(raw.page),
    limit: scalar(raw.limit),
  }
}

export const dynamic = 'force-dynamic'

interface AdminPoliciesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AdminPoliciesPage({
  searchParams,
}: AdminPoliciesPageProps) {
  await requireAdmin()
  const raw = await searchParams
  const filters = parseFiltersFromSearchParams(raw)

  const result = await fetchPolicyWorkspaceAction(filters)
  if (!result.ok) {
    // Bad filter params → strip them and reload with a clean slate.
    if (result.fieldErrors) redirect('/admin/policies')
    throw new Error(result.error ?? 'Could not load policies')
  }

  return <PoliciesShell initialData={result.data} />
}

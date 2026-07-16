import { redirect } from 'next/navigation'

import { requireAdmin } from '@/lib/auth/get-user'
import { TasksShell } from '@/components/admin/tasks/tasks-shell'

import { fetchTaskWorkspaceAction } from './actions'

// Parses the raw ?search=&statusId=... query params into the shape
// taskFilterSchema expects (arrays for multi-select facets). Left
// permissive — Zod does the actual validation on the server.
function parseFiltersFromSearchParams(
  raw: Record<string, string | string[] | undefined>,
): Record<string, unknown> {
  const arr = (v: string | string[] | undefined) =>
    v === undefined ? undefined : Array.isArray(v) ? v : v.split(',')
  const scalar = (v: string | string[] | undefined) =>
    v === undefined ? undefined : Array.isArray(v) ? v[0] : v

  return {
    search: scalar(raw.q),
    statusIds: arr(raw.status),
    priorities: arr(raw.priority),
    categoryIds: arr(raw.category),
    labelIds: arr(raw.label),
    assigneeIds: arr(raw.assignee),
    includeArchived: scalar(raw.archived) === '1',
    sortBy: scalar(raw.sort),
    sortOrder: scalar(raw.dir),
    page: scalar(raw.page),
    limit: scalar(raw.limit),
  }
}

export const dynamic = 'force-dynamic'

interface AdminTasksPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AdminTasksPage({
  searchParams,
}: AdminTasksPageProps) {
  await requireAdmin()
  const raw = await searchParams
  const filters = parseFiltersFromSearchParams(raw)

  const result = await fetchTaskWorkspaceAction(filters)
  if (!result.ok) {
    // Bad filter params → strip them and reload with a clean slate.
    // Any other error surfaces to the closest error boundary.
    if (result.fieldErrors) redirect('/admin/tasks')
    throw new Error(result.error ?? 'Could not load task workspace')
  }

  return <TasksShell initialData={result.data} />
}

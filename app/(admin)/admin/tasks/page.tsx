import { redirect } from 'next/navigation'

import { requireTeamOrAdmin } from '@/lib/auth/get-user'
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
    // "Only mine" — the shell's own filter, folded into assigneeIds
    // inside fetchTaskWorkspaceAction (which has the current user).
    // Passed as a boolean so the action's cleanedFilters branch
    // fires whether or not the URL uses '1' vs 'true'.
    mine: scalar(raw.mine) === '1',
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
  // TEAM users have their own view at /team/tasks — send them
  // there with the query params intact so bookmarks and inbound
  // /admin/tasks?task=… links still land somewhere useful instead
  // of hitting a hard redirect to /dashboard.
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
    redirect(suffix ? `/team/tasks?${suffix}` : '/team/tasks')
  }

  const filters = parseFiltersFromSearchParams(raw)

  // Board is the default view — lift the page cap + force
  // orderIndex sort so cards land in their column positions. Only
  // ?view=list opts back into the paged table.
  const view = Array.isArray(raw.view) ? raw.view[0] : raw.view
  if (view !== 'list') {
    filters.limit = 500
    filters.sortBy = 'orderIndex'
    filters.sortOrder = 'asc'
  }

  const result = await fetchTaskWorkspaceAction(filters)
  if (!result.ok) {
    // Bad filter params → strip them and reload with a clean slate.
    // Any other error surfaces to the closest error boundary.
    if (result.fieldErrors) redirect('/admin/tasks')
    throw new Error(result.error ?? 'Could not load task workspace')
  }

  return <TasksShell initialData={result.data} />
}

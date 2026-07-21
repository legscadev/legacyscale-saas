import { redirect } from 'next/navigation'

import { requireTeamModuleAccess } from '@/lib/auth/get-user'
import { TasksShell } from '@/components/admin/tasks/tasks-shell'
import { fetchTaskWorkspaceAction } from '@/app/(admin)/admin/tasks/actions'

// Thin wrapper for the TEAM read/write view of the Task Tracker.
// Mirrors /admin/tasks — same shell, same action, same behaviour —
// under a /team/* URL so staff URLs stay separate from admin URLs.
// ADMIN gets bounced to /admin/tasks so they don't see their own
// module through a member-shell lens.

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
    mine: scalar(raw.mine) === '1',
    sortBy: scalar(raw.sort),
    sortOrder: scalar(raw.dir),
    page: scalar(raw.page),
    limit: scalar(raw.limit),
  }
}

export const dynamic = 'force-dynamic'

interface TeamTasksPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function TeamTasksPage({
  searchParams,
}: TeamTasksPageProps) {
  const viewer = await requireTeamModuleAccess('tasks')
  if (viewer.role === 'ADMIN') redirect('/admin/tasks')

  const raw = await searchParams
  const filters = parseFiltersFromSearchParams(raw)

  const view = Array.isArray(raw.view) ? raw.view[0] : raw.view
  if (view !== 'list') {
    filters.limit = 500
    filters.sortBy = 'orderIndex'
    filters.sortOrder = 'asc'
  }

  const result = await fetchTaskWorkspaceAction(filters)
  if (!result.ok) {
    if (result.fieldErrors) redirect('/team/tasks')
    throw new Error(result.error ?? 'Could not load task workspace')
  }

  return <TasksShell initialData={result.data} />
}

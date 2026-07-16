'use client'

// Root client shell for /admin/tasks. Owns the visible view state
// (list vs kanban, filters, selected task) and holds a live copy of
// the workspace payload that server actions update via revalidate.
//
// Phase 2.1 stubs the shell so the route + workspace fetch work
// end-to-end; deeper subcomponents (stat strip, table, filter bar,
// create dialog, kanban) land in follow-up commits.

import { CheckSquare } from 'lucide-react'

import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'

import type { TaskWorkspacePayload } from '@/app/(admin)/admin/tasks/actions'

interface TasksShellProps {
  initialData: TaskWorkspacePayload
}

export function TasksShell({ initialData }: TasksShellProps) {
  const { tasks, stats, statuses, categories, labels, members } = initialData
  const hasTasks = tasks.items.length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Track internal work across your team. Filter by status, priority, category, or label."
      />

      {hasTasks ? (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Workspace loaded: {stats.total} total ({stats.openTotal} open,{' '}
          {stats.overdue} overdue). Statuses: {statuses.length}. Labels:{' '}
          {labels.length}. Categories: {categories.length}. Team members:{' '}
          {members.length}. List UI ships in Phase 2.3.
        </div>
      ) : (
        <EmptyState
          icon={CheckSquare}
          title="No tasks yet"
          description="Create your first task to start tracking internal work. The Create dialog lands in Phase 2.4."
        />
      )}
    </div>
  )
}

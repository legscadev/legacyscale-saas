'use client'

// The Kanban board — one column per tenant status, cards ordered
// by orderIndex within their column. Phase 3.1 ships the static
// layout; dnd-kit wiring lands in 3.2/3.3.
//
// Cards for a status the board hasn't rendered a column for (e.g.
// an archived tenant status that still holds tasks) roll up under
// an "Uncategorized" column at the end so we never lose visibility
// of a task just because its status was hidden.

import { useMemo } from 'react'
import { CheckSquare } from 'lucide-react'

import { EmptyState } from '@/components/shared/empty-state'
import { cn } from '@/lib/utils'

import type { WorkflowStatus } from '@/app/(admin)/admin/tasks/actions'
import type { TaskListItem } from '@/lib/services/task-service'

import { KanbanCard } from './kanban-card'

interface KanbanBoardProps {
  statuses: WorkflowStatus[]
  tasks: TaskListItem[]
  onOpenTask?: (id: string) => void
  onCreate?: () => void
}

interface Column {
  id: string
  name: string
  color: string
  isTerminal: boolean
  wipLimit: number | null
  tasks: TaskListItem[]
}

/** Group cards by statusId, preserving the tenant status order and
 *  appending a synthetic "Uncategorized" bucket for orphans. */
function groupTasksByStatus(
  statuses: WorkflowStatus[],
  tasks: TaskListItem[],
): Column[] {
  const byStatus = new Map<string, TaskListItem[]>()
  for (const t of tasks) {
    const list = byStatus.get(t.statusId) ?? []
    list.push(t)
    byStatus.set(t.statusId, list)
  }
  const columns: Column[] = statuses.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    isTerminal: s.isTerminal,
    wipLimit: s.wipLimit,
    tasks: (byStatus.get(s.id) ?? []).slice().sort(
      (a, b) => a.orderIndex - b.orderIndex,
    ),
  }))

  // Orphan bucket — tasks whose statusId isn't in the visible
  // status list. Only rendered when it has content.
  const known = new Set(statuses.map((s) => s.id))
  const orphans = tasks.filter((t) => !known.has(t.statusId))
  if (orphans.length > 0) {
    columns.push({
      id: '__orphans__',
      name: 'Uncategorized',
      color: '#64748b',
      isTerminal: false,
      wipLimit: null,
      tasks: orphans.slice().sort((a, b) => a.orderIndex - b.orderIndex),
    })
  }
  return columns
}

export function KanbanBoard({
  statuses,
  tasks,
  onOpenTask,
  onCreate,
}: KanbanBoardProps) {
  const columns = useMemo(
    () => groupTasksByStatus(statuses, tasks),
    [statuses, tasks],
  )

  if (columns.length === 0) {
    return (
      <EmptyState
        icon={CheckSquare}
        title="No columns yet"
        description="Configure statuses under Workflow admin (Phase 6) to see them here."
      />
    )
  }

  return (
    <div className="-mx-2 overflow-x-auto pb-2">
      <div className="flex min-w-full gap-3 px-2">
        {columns.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            onOpenTask={onOpenTask}
            onCreate={onCreate}
          />
        ))}
      </div>
    </div>
  )
}

// =========================================================
// Column
// =========================================================

interface KanbanColumnProps {
  column: Column
  onOpenTask?: (id: string) => void
  onCreate?: () => void
}

function KanbanColumn({ column, onOpenTask, onCreate }: KanbanColumnProps) {
  const overWip =
    column.wipLimit !== null && column.tasks.length > column.wipLimit
  return (
    <section
      aria-label={`${column.name} column`}
      className="flex w-72 shrink-0 flex-col rounded-xl border bg-muted/30"
    >
      <header
        className="flex items-center justify-between border-b px-3 py-2"
        style={{ borderTopColor: column.color, borderTopWidth: 3 }}
      >
        <div className="flex items-center gap-2">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: column.color }}
            aria-hidden
          />
          <p className="text-sm font-medium">{column.name}</p>
          <span
            className={cn(
              'rounded-full bg-background px-1.5 text-[10px] font-semibold text-muted-foreground tabular-nums',
              overWip && 'bg-rose-100 text-rose-700',
            )}
          >
            {column.tasks.length}
            {column.wipLimit !== null ? `/${column.wipLimit}` : null}
          </span>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-2 p-2">
        {column.tasks.length === 0 ? (
          <button
            type="button"
            onClick={onCreate}
            className={cn(
              'flex h-24 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground',
              'transition-colors hover:border-primary/40 hover:text-foreground',
            )}
          >
            Drop tasks here or create one
          </button>
        ) : (
          column.tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              onOpen={onOpenTask ? () => onOpenTask(task.id) : undefined}
            />
          ))
        )}
      </div>
    </section>
  )
}

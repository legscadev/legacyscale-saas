'use client'

// Root client shell for /admin/tasks. Owns the visible view state
// (list/kanban toggle, filters, selected task) and holds a live
// copy of the workspace payload that server actions update via
// revalidate.

import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { Plus } from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'

import type { TaskWorkspacePayload } from '@/app/(admin)/admin/tasks/actions'

import { CreateTaskDialog } from './create-task-dialog'
import { KanbanBoard } from './kanban-board'
import { TaskDetailDrawer } from './task-detail-drawer'
import { TasksFilterBar } from './tasks-filter-bar'
import { TasksStatStrip } from './tasks-stat-strip'
import { TasksTable } from './tasks-table'
import { ViewToggle, type TasksViewMode } from './view-toggle'

type SortField =
  | 'createdAt'
  | 'updatedAt'
  | 'dueDate'
  | 'priority'
  | 'orderIndex'
type SortDir = 'asc' | 'desc'

interface TasksShellProps {
  initialData: TaskWorkspacePayload
}

export function TasksShell({ initialData }: TasksShellProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isNavigating, startNavigation] = useTransition()
  const [createOpen, setCreateOpen] = useState(false)

  const { tasks, stats, statuses, categories, labels, members } = initialData

  // View comes from ?view=; defaults to list.
  const view: TasksViewMode =
    searchParams.get('view') === 'board' ? 'board' : 'list'

  // Drawer open state is URL-driven — ?task=<id>. Deep-linkable +
  // survives refresh. Clicking a row or card sets it; the drawer's
  // onOpenChange clears it.
  const openTaskId = searchParams.get('task')

  // Sort state comes from the URL — page.tsx re-fetches with the
  // new params on router.push. Defaults mirror taskFilterSchema.
  const sortBy = (searchParams.get('sort') as SortField) ?? 'createdAt'
  const sortOrder = (searchParams.get('dir') as SortDir) ?? 'desc'

  const paramsCopy = useMemo(
    () => new URLSearchParams(searchParams.toString()),
    [searchParams],
  )

  function refreshWorkspace() {
    startNavigation(() => {
      router.refresh()
    })
  }

  function openTask(id: string) {
    const next = new URLSearchParams(paramsCopy)
    next.set('task', id)
    startNavigation(() => {
      router.push(`/admin/tasks?${next.toString()}`, { scroll: false })
    })
  }

  function closeTask() {
    const next = new URLSearchParams(paramsCopy)
    next.delete('task')
    startNavigation(() => {
      router.push(
        next.toString() ? `/admin/tasks?${next.toString()}` : '/admin/tasks',
        { scroll: false },
      )
    })
  }

  function handleSortChange(field: SortField) {
    const next = new URLSearchParams(paramsCopy)
    if (next.get('sort') === field) {
      next.set('dir', sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      next.set('sort', field)
      next.set('dir', field === 'dueDate' ? 'asc' : 'desc')
    }
    startNavigation(() => {
      router.push(`/admin/tasks?${next.toString()}`)
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Track internal work across your team. Filter, prioritize, and hand off."
        actions={
          <div className="flex items-center gap-2">
            <ViewToggle value={view} />
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              New task
            </Button>
          </div>
        }
      />

      <TasksStatStrip stats={stats} />

      <TasksFilterBar
        statuses={statuses}
        categories={categories}
        labels={labels}
        members={members}
      />

      <div
        aria-busy={isNavigating}
        className={isNavigating ? 'opacity-70 transition-opacity' : ''}
      >
        {view === 'board' ? (
          <KanbanBoard
            statuses={statuses}
            tasks={tasks.items}
            onCreate={() => setCreateOpen(true)}
            onChanged={refreshWorkspace}
            onOpenTask={openTask}
          />
        ) : (
          <TasksTable
            items={tasks.items}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
            onRowChanged={refreshWorkspace}
            onCreate={() => setCreateOpen(true)}
            onOpenTask={openTask}
          />
        )}
      </div>

      <TaskDetailDrawer
        taskId={openTaskId}
        statuses={statuses}
        categories={categories}
        onOpenChange={(open) => {
          if (!open) closeTask()
        }}
        onChanged={refreshWorkspace}
      />

      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={async () => {
          setCreateOpen(false)
          refreshWorkspace()
        }}
        statuses={statuses}
        categories={categories}
      />
    </div>
  )
}

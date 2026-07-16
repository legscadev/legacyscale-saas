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
import { TasksStatStrip } from './tasks-stat-strip'
import { TasksTable } from './tasks-table'

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

  const { tasks, stats, statuses, categories } = initialData

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
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New task
          </Button>
        }
      />

      <TasksStatStrip stats={stats} />

      <div
        aria-busy={isNavigating}
        className={isNavigating ? 'opacity-70 transition-opacity' : ''}
      >
        <TasksTable
          items={tasks.items}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
          onRowChanged={refreshWorkspace}
          onCreate={() => setCreateOpen(true)}
        />
      </div>

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

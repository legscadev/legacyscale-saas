'use client'

// Root client shell for /admin/tasks. Owns the visible view state
// (list/kanban toggle, filters, selected task) and holds a live
// copy of the workspace payload that server actions update via
// revalidate.
//
// Phase 2.3: list view with the stat strip + read-only table.
// Filter bar + URL state + create dialog + row actions land in
// 2.4 → 2.5.

import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useTransition } from 'react'

import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

import type { TaskWorkspacePayload } from '@/app/(admin)/admin/tasks/actions'

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

  const { tasks, stats } = initialData

  // Sort state comes from the URL — parent page.tsx re-fetches
  // with the new params on router.push. Defaults mirror
  // taskFilterSchema.
  const sortBy = (searchParams.get('sort') as SortField) ?? 'createdAt'
  const sortOrder = (searchParams.get('dir') as SortDir) ?? 'desc'

  // Cloning searchParams via URLSearchParams because the object is
  // readonly and we need to mutate before pushing.
  const paramsCopy = useMemo(
    () => new URLSearchParams(searchParams.toString()),
    [searchParams],
  )

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
          <Button disabled title="Create dialog lands in Phase 2.4">
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
        />
      </div>
    </div>
  )
}

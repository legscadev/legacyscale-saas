'use client'

// The list-view table. Read-only presentation in Phase 2.3;
// row-actions dropdown lands in 2.4 and drag-to-reorder in Phase 3.
//
// Sorting is server-side (URL-driven) — clicking a sortable column
// header replays the fetch with the new sort. The parent shell owns
// that plumbing; this component just emits `onSortChange`.

import { format } from 'date-fns'
import { ArrowUpDown, MessageSquare, Paperclip } from 'lucide-react'

import { AvatarGroup } from '@/components/shared/avatar-group'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { CheckSquare } from 'lucide-react'

import type { TaskListItem } from '@/lib/services/task-service'

import { LabelChip, PriorityPill, StatusPill } from './task-pills'

type SortField = 'createdAt' | 'updatedAt' | 'dueDate' | 'priority' | 'orderIndex'
type SortDir = 'asc' | 'desc'

interface TasksTableProps {
  items: TaskListItem[]
  sortBy: SortField
  sortOrder: SortDir
  onSortChange: (field: SortField) => void
  onOpenTask?: (id: string) => void
  onCreate?: () => void
}

export function TasksTable({
  items,
  sortBy,
  sortOrder,
  onSortChange,
  onOpenTask,
  onCreate,
}: TasksTableProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={CheckSquare}
        title="No tasks match these filters"
        description="Try broadening the filter set or create a new task."
      >
        {onCreate ? (
          <Button onClick={onCreate}>Create a task</Button>
        ) : null}
      </EmptyState>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead
              field="createdAt"
              current={sortBy}
              dir={sortOrder}
              onSortChange={onSortChange}
            >
              Title
            </SortableHead>
            <TableHead className="w-32">Status</TableHead>
            <SortableHead
              field="priority"
              current={sortBy}
              dir={sortOrder}
              onSortChange={onSortChange}
              className="w-24"
            >
              Priority
            </SortableHead>
            <TableHead className="w-40">Assignees</TableHead>
            <SortableHead
              field="dueDate"
              current={sortBy}
              dir={sortOrder}
              onSortChange={onSortChange}
              className="w-28"
            >
              Due
            </SortableHead>
            <TableHead className="w-32">Labels</TableHead>
            <TableHead className="w-20 text-right">Meta</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((task) => {
            const overdue =
              task.dueDate !== null &&
              task.dueDate.getTime() < Date.now() &&
              !task.status.isTerminal
            return (
              <TableRow
                key={task.id}
                className={cn(
                  onOpenTask &&
                    'cursor-pointer transition-colors hover:bg-muted/50',
                )}
                onClick={onOpenTask ? () => onOpenTask(task.id) : undefined}
              >
                <TableCell className="min-w-0">
                  <div className="flex flex-col gap-0.5">
                    <p className="line-clamp-1 font-medium text-foreground">
                      {task.title}
                    </p>
                    {task.category ? (
                      <p className="text-[11px] text-muted-foreground">
                        {task.category.name}
                      </p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusPill
                    name={task.status.name}
                    color={task.status.color}
                  />
                </TableCell>
                <TableCell>
                  <PriorityPill priority={task.priority} />
                </TableCell>
                <TableCell>
                  {task.assignees.length > 0 ? (
                    <AvatarGroup
                      users={task.assignees.map((a) => ({
                        name: a.name ?? a.email,
                        avatarUrl: null,
                      }))}
                      size="sm"
                      max={4}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {task.dueDate ? (
                    <span
                      className={cn(
                        'text-xs tabular-nums',
                        overdue
                          ? 'font-medium text-rose-600'
                          : 'text-muted-foreground',
                      )}
                    >
                      {format(task.dueDate, 'MMM d')}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {task.labels.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {task.labels.slice(0, 3).map((l) => (
                        <LabelChip key={l.id} name={l.name} color={l.color} />
                      ))}
                      {task.labels.length > 3 ? (
                        <span className="text-[10px] text-muted-foreground">
                          +{task.labels.length - 3}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <MetaSummary task={task} />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

// =========================================================
// Sortable header cell
// =========================================================

interface SortableHeadProps {
  field: SortField
  current: SortField
  dir: SortDir
  onSortChange: (field: SortField) => void
  children: React.ReactNode
  className?: string
}

function SortableHead({
  field,
  current,
  dir,
  onSortChange,
  children,
  className,
}: SortableHeadProps) {
  const isActive = current === field
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSortChange(field)}
        className={cn(
          'flex items-center gap-1 text-left text-xs font-medium uppercase tracking-wider transition-colors',
          isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {children}
        <ArrowUpDown
          className={cn(
            'size-3',
            isActive ? 'text-foreground' : 'opacity-40',
            isActive && dir === 'asc' && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
    </TableHead>
  )
}

// =========================================================
// Meta: comment + attachment + subtask + checklist counts
// =========================================================

function MetaSummary({ task }: { task: TaskListItem }) {
  const hasMeta =
    task.commentCount > 0 ||
    task.attachmentCount > 0 ||
    task.checklistTotal > 0
  if (!hasMeta) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  return (
    <div className="flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
      {task.commentCount > 0 ? (
        <span className="inline-flex items-center gap-0.5">
          <MessageSquare className="size-3" aria-hidden />
          {task.commentCount}
        </span>
      ) : null}
      {task.attachmentCount > 0 ? (
        <span className="inline-flex items-center gap-0.5">
          <Paperclip className="size-3" aria-hidden />
          {task.attachmentCount}
        </span>
      ) : null}
      {task.checklistTotal > 0 ? (
        <span className="tabular-nums">
          {task.checklistDone}/{task.checklistTotal}
        </span>
      ) : null}
    </div>
  )
}

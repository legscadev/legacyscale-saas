'use client'

// A single Kanban card. Rendered as a static block in 3.1; wired
// into useSortable in Phase 3.2. Kept small + self-contained so
// the sortable wrapper only has to spread ref + listeners onto
// the outer div.

import { format, isPast } from 'date-fns'
import { forwardRef } from 'react'
import { CalendarDays, MessageSquare, Paperclip } from 'lucide-react'

import { AvatarGroup } from '@/components/shared/avatar-group'
import { cn } from '@/lib/utils'

import type { TaskListItem } from '@/lib/services/task-service'

import { LabelChip, PriorityPill } from './task-pills'

interface KanbanCardProps extends React.HTMLAttributes<HTMLDivElement> {
  task: TaskListItem
  /** True while the card is being lifted by dnd-kit; parent applies
   *  the "ghost" style to the underlying slot. Card content stays
   *  visible on the overlay. */
  isDragging?: boolean
  onOpen?: () => void
}

/**
 * ForwardRef so useSortable can attach its ref. All extra props
 * (listeners, attributes) spread onto the outer div — the caller
 * controls the drag handle vs whole-card grab.
 */
export const KanbanCard = forwardRef<HTMLDivElement, KanbanCardProps>(
  function KanbanCard(
    { task, isDragging, onOpen, className, ...rest },
    ref,
  ) {
    const overdue =
      task.dueDate !== null &&
      isPast(task.dueDate) &&
      !task.status.isTerminal

    return (
      <div
        ref={ref}
        {...rest}
        onClick={(e) => {
          rest.onClick?.(e)
          if (!e.defaultPrevented && onOpen) onOpen()
        }}
        className={cn(
          'group/kanban-card space-y-2 rounded-lg border bg-card p-3 shadow-sm',
          'cursor-grab transition-colors hover:border-primary/30 hover:bg-accent/40',
          'active:cursor-grabbing',
          isDragging && 'opacity-40',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-sm font-medium leading-snug">
            {task.title}
          </p>
          <PriorityPill priority={task.priority} className="shrink-0" />
        </div>

        {task.labels.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {task.labels.slice(0, 4).map((l) => (
              <LabelChip key={l.id} name={l.name} color={l.color} />
            ))}
            {task.labels.length > 4 ? (
              <span className="text-[10px] text-muted-foreground">
                +{task.labels.length - 4}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <div className="flex min-w-0 items-center gap-2">
            {task.dueDate ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1 tabular-nums',
                  overdue && 'font-medium text-rose-600',
                )}
              >
                <CalendarDays className="size-3" aria-hidden />
                {format(task.dueDate, 'MMM d')}
              </span>
            ) : null}
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
          {task.assignees.length > 0 ? (
            <AvatarGroup
              users={task.assignees.map((a) => ({
                name: a.name ?? a.email,
                avatarUrl: null,
              }))}
              size="sm"
              max={3}
            />
          ) : null}
        </div>
      </div>
    )
  },
)

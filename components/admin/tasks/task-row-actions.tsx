'use client'

// Row-action dropdown for the tracker's list-view table. Renders
// as a ghost 3-dot button in the trailing edge of each row; clicks
// stop-propagation so the parent row's "open drawer" handler
// (Phase 4) doesn't fire.
//
// Only the actions that make sense from a row menu live here.
// Detail-drawer-only actions (assign, watchers, comments) are
// deliberately absent — they belong in Phase 4.

import { useTransition } from 'react'
import {
  Archive,
  ArchiveRestore,
  Copy,
  MoreHorizontal,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  archiveTaskAction,
  deleteTaskAction,
  duplicateTaskAction,
  restoreTaskAction,
} from '@/app/(admin)/admin/tasks/actions'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { TaskListItem } from '@/lib/services/task-service'

interface TaskRowActionsProps {
  task: TaskListItem
  onChanged: () => void | Promise<void>
}

export function TaskRowActions({ task, onChanged }: TaskRowActionsProps) {
  const [isPending, startTransition] = useTransition()
  const isArchived = task.archivedAt !== null

  function run(
    label: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
  ) {
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) {
        toast.error(res.error ?? `Could not ${label.toLowerCase()}`)
        return
      }
      toast.success(`${label}d`)
      await onChanged()
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        render={
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Actions for ${task.title}`}
            className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          />
        }
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem
          onSelect={() =>
            run('Duplicate', () => duplicateTaskAction(task.id))
          }
        >
          <Copy className="size-4" />
          Duplicate
        </DropdownMenuItem>

        {isArchived ? (
          <DropdownMenuItem
            onSelect={() =>
              run('Restore', () => restoreTaskAction(task.id))
            }
          >
            <ArchiveRestore className="size-4" />
            Restore
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onSelect={() =>
              run('Archive', () => archiveTaskAction(task.id))
            }
          >
            <Archive className="size-4" />
            Archive
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() =>
            run('Delete', () => deleteTaskAction(task.id))
          }
        >
          <Trash2 className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

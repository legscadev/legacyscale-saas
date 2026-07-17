'use client'

// Bulk-action bar that appears above the tasks table whenever ≥ 1
// row is selected. Actions loop the per-row service methods on
// the server (see runBulk in actions.ts) so activity + notifications
// still fire per row; partial failures surface as a toast showing
// the failed count.

import { useState, useTransition } from 'react'
import {
  Archive,
  ArrowRight,
  Loader2,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  bulkArchiveTasksAction,
  bulkChangeStatusAction,
  bulkDeleteTasksAction,
  type WorkflowStatus,
} from '@/app/(admin)/admin/tasks/actions'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface BulkActionBarProps {
  selectedIds: string[]
  statuses: WorkflowStatus[]
  onClear: () => void
  onChanged: () => void | Promise<void>
}

export function BulkActionBar({
  selectedIds,
  statuses,
  onClear,
  onChanged,
}: BulkActionBarProps) {
  const [isBusy, startBusy] = useTransition()
  const [statusPickerOpen, setStatusPickerOpen] = useState(false)

  if (selectedIds.length === 0) return null

  function runAndToast(
    label: string,
    fn: () => Promise<
      | { ok: true; data: { updated: number; failedIds: string[] } }
      | { ok: false; error?: string }
    >,
  ) {
    startBusy(async () => {
      const res = await fn()
      if (!res.ok) {
        toast.error(res.error ?? `Could not ${label.toLowerCase()}`)
        return
      }
      if (res.data.failedIds.length === 0) {
        toast.success(`${label}d ${res.data.updated} task${res.data.updated === 1 ? '' : 's'}`)
      } else {
        toast.warning(
          `${label}d ${res.data.updated}, ${res.data.failedIds.length} failed`,
        )
      }
      await onChanged()
      onClear()
    })
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-primary/5 px-3 py-2 text-sm">
      <span className="font-medium tabular-nums">
        {selectedIds.length} selected
      </span>
      <span className="text-muted-foreground">·</span>

      <DropdownMenu open={statusPickerOpen} onOpenChange={setStatusPickerOpen}>
        <DropdownMenuTrigger
          disabled={isBusy}
          render={
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
            />
          }
        >
          <ArrowRight className="size-3" />
          Change status
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {statuses.map((s) => (
            <DropdownMenuItem
              key={s.id}
              onClick={() =>
                runAndToast('Move', () =>
                  bulkChangeStatusAction(selectedIds, s.id),
                )
              }
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: s.color }}
                aria-hidden
              />
              {s.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        size="sm"
        variant="outline"
        disabled={isBusy}
        onClick={() =>
          runAndToast('Archive', () => bulkArchiveTasksAction(selectedIds))
        }
      >
        <Archive className="size-3.5" />
        Archive
      </Button>

      <Button
        size="sm"
        variant="outline"
        disabled={isBusy}
        onClick={() => {
          if (
            !confirm(
              `Delete ${selectedIds.length} task${selectedIds.length === 1 ? '' : 's'}? They can be restored from the archived view.`,
            )
          ) {
            return
          }
          runAndToast('Delete', () => bulkDeleteTasksAction(selectedIds))
        }}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="size-3.5" />
        Delete
      </Button>

      <div className="flex-1" />

      {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : null}

      <Button
        size="icon-sm"
        variant="ghost"
        onClick={onClear}
        aria-label="Clear selection"
        disabled={isBusy}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  )
}

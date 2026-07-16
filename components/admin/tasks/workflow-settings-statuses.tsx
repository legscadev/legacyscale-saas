'use client'

// Statuses table for the workflow admin. Every column is inline-
// editable — name, slug, color, default, terminal, WIP limit. Save
// on blur / Enter; toast on failure. Delete is guarded by the
// service (StatusInUseError / LastStatusError bubble to a toast).

import { useEffect, useState, useTransition } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  deleteStatusAction,
  upsertStatusAction,
} from '@/app/(admin)/admin/tasks/settings/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { StatusListItem } from '@/lib/services/task-workflow-service'

interface StatusRowsProps {
  statuses: StatusListItem[]
  onPatched: (next: StatusListItem) => void
  onDeleted: (id: string) => void
}

export function StatusRows({
  statuses,
  onPatched,
  onDeleted,
}: StatusRowsProps) {
  if (statuses.length === 0) {
    return (
      <p className="p-4 text-center text-xs text-muted-foreground">
        No statuses yet. Add one to get started.
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">Color</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Slug</TableHead>
          <TableHead className="w-20 text-center">Default</TableHead>
          <TableHead className="w-24 text-center">Terminal</TableHead>
          <TableHead className="w-24">WIP</TableHead>
          <TableHead className="w-16 text-right">Tasks</TableHead>
          <TableHead className="w-10" aria-label="Actions" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {statuses.map((status) => (
          <StatusRow
            key={status.id}
            status={status}
            onPatched={onPatched}
            onDeleted={onDeleted}
          />
        ))}
      </TableBody>
    </Table>
  )
}

// =========================================================
// One row
// =========================================================

function StatusRow({
  status,
  onPatched,
  onDeleted,
}: {
  status: StatusListItem
  onPatched: (next: StatusListItem) => void
  onDeleted: (id: string) => void
}) {
  const [isBusy, startBusy] = useTransition()

  function save(patch: Partial<StatusListItem>) {
    // Merge in-flight; refuse trivial no-ops.
    const next = { ...status, ...patch }
    const changed = (Object.keys(patch) as Array<keyof StatusListItem>).some(
      (k) => next[k] !== status[k],
    )
    if (!changed) return
    startBusy(async () => {
      const res = await upsertStatusAction({
        id: next.id,
        name: next.name,
        slug: next.slug,
        color: next.color,
        orderIndex: next.orderIndex,
        isDefault: next.isDefault,
        isTerminal: next.isTerminal,
        wipLimit: next.wipLimit,
      })
      if (!res.ok) {
        toast.error(
          Object.values(res.fieldErrors ?? {}).flat()[0] ??
            res.error ??
            'Could not save',
        )
        return
      }
      onPatched(res.data)
    })
  }

  function remove() {
    if (
      !confirm(
        status.taskCount > 0
          ? `${status.taskCount} task${status.taskCount === 1 ? ' still uses' : 's still use'} "${status.name}". Move them to another status first.`
          : `Delete status "${status.name}"?`,
      )
    ) {
      return
    }
    startBusy(async () => {
      const res = await deleteStatusAction(status.id)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not delete status')
        return
      }
      onDeleted(status.id)
    })
  }

  return (
    <TableRow
      className={cn(isBusy && 'opacity-60 transition-opacity')}
    >
      <TableCell>
        <input
          type="color"
          value={status.color}
          onChange={(e) => save({ color: e.target.value })}
          disabled={isBusy}
          aria-label={`Color for ${status.name}`}
          className="h-8 w-10 cursor-pointer rounded border bg-transparent"
        />
      </TableCell>
      <TableCell>
        <BlurCommitInput
          value={status.name}
          onCommit={(v) => save({ name: v })}
          disabled={isBusy}
        />
      </TableCell>
      <TableCell>
        <BlurCommitInput
          value={status.slug}
          onCommit={(v) => save({ slug: v.toLowerCase() })}
          disabled={isBusy}
          mono
        />
      </TableCell>
      <TableCell className="text-center">
        <input
          type="checkbox"
          checked={status.isDefault}
          onChange={(e) => save({ isDefault: e.target.checked })}
          disabled={isBusy}
          className="size-4 accent-primary"
        />
      </TableCell>
      <TableCell className="text-center">
        <input
          type="checkbox"
          checked={status.isTerminal}
          onChange={(e) => save({ isTerminal: e.target.checked })}
          disabled={isBusy}
          className="size-4 accent-primary"
        />
      </TableCell>
      <TableCell>
        <BlurCommitInput
          value={status.wipLimit === null ? '' : String(status.wipLimit)}
          onCommit={(v) => {
            const trimmed = v.trim()
            const num = trimmed === '' ? null : Number(trimmed)
            if (num !== null && (Number.isNaN(num) || num < 0)) {
              toast.error('WIP limit must be a positive number')
              return
            }
            save({ wipLimit: num })
          }}
          disabled={isBusy}
          placeholder="—"
        />
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
        {status.taskCount}
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={remove}
          disabled={isBusy}
          aria-label={`Delete ${status.name}`}
          className="text-muted-foreground hover:text-destructive"
        >
          {isBusy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
        </Button>
      </TableCell>
    </TableRow>
  )
}

// =========================================================
// Small blur/enter-commit input
// =========================================================

interface BlurCommitInputProps {
  value: string
  onCommit: (next: string) => void
  disabled?: boolean
  mono?: boolean
  placeholder?: string
}

function BlurCommitInput({
  value,
  onCommit,
  disabled,
  mono,
  placeholder,
}: BlurCommitInputProps) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          ;(e.target as HTMLInputElement).blur()
        } else if (e.key === 'Escape') {
          setDraft(value)
          ;(e.target as HTMLInputElement).blur()
        }
      }}
      disabled={disabled}
      placeholder={placeholder}
      className={cn('h-8 text-sm', mono && 'font-mono')}
    />
  )
}

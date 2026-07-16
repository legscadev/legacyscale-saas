'use client'

// Shared table for categories + labels — same shape (name + color +
// taskCount), same interactions (inline edit + delete). The
// specialized service action (upsertCategory vs upsertLabel) is
// injected via the `onSave` / `onDelete` callbacks the parent
// binds.

import { useEffect, useState, useTransition } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

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

interface TaxonomyItem {
  id: string
  name: string
  color: string
  taskCount: number
}

interface CategoryLabelRowsProps<T extends TaxonomyItem> {
  items: T[]
  onSave: (input: {
    id: string
    name: string
    color: string
  }) => Promise<
    | { ok: true; data: T }
    | { ok: false; error?: string; fieldErrors?: Record<string, string[]> }
  >
  onDelete: (
    id: string,
  ) => Promise<{ ok: true; data: void } | { ok: false; error?: string }>
  onPatched: (next: T) => void
  onDeleted: (id: string) => void
  emptyLabel: string
}

export function CategoryLabelRows<T extends TaxonomyItem>({
  items,
  onSave,
  onDelete,
  onPatched,
  onDeleted,
  emptyLabel,
}: CategoryLabelRowsProps<T>) {
  if (items.length === 0) {
    return (
      <p className="p-4 text-center text-xs text-muted-foreground">
        {emptyLabel}
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">Color</TableHead>
          <TableHead>Name</TableHead>
          <TableHead className="w-24 text-right">Tasks</TableHead>
          <TableHead className="w-10" aria-label="Actions" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            onSave={onSave}
            onDelete={onDelete}
            onPatched={onPatched}
            onDeleted={onDeleted}
          />
        ))}
      </TableBody>
    </Table>
  )
}

function ItemRow<T extends TaxonomyItem>({
  item,
  onSave,
  onDelete,
  onPatched,
  onDeleted,
}: {
  item: T
  onSave: CategoryLabelRowsProps<T>['onSave']
  onDelete: CategoryLabelRowsProps<T>['onDelete']
  onPatched: (next: T) => void
  onDeleted: (id: string) => void
}) {
  const [isBusy, startBusy] = useTransition()
  const [draftName, setDraftName] = useState(item.name)
  useEffect(() => setDraftName(item.name), [item.name])

  function commitName() {
    const next = draftName.trim()
    if (!next || next === item.name) {
      setDraftName(item.name)
      return
    }
    startBusy(async () => {
      const res = await onSave({ id: item.id, name: next, color: item.color })
      if (!res.ok) {
        toast.error(
          Object.values(res.fieldErrors ?? {}).flat()[0] ??
            res.error ??
            'Could not save',
        )
        setDraftName(item.name)
        return
      }
      onPatched(res.data)
    })
  }

  function commitColor(color: string) {
    if (color === item.color) return
    startBusy(async () => {
      const res = await onSave({ id: item.id, name: item.name, color })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not save')
        return
      }
      onPatched(res.data)
    })
  }

  function remove() {
    if (
      !confirm(
        item.taskCount > 0
          ? `"${item.name}" is on ${item.taskCount} task${item.taskCount === 1 ? '' : 's'}. Delete anyway? (Tasks keep their history; the association is removed.)`
          : `Delete "${item.name}"?`,
      )
    ) {
      return
    }
    startBusy(async () => {
      const res = await onDelete(item.id)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not delete')
        return
      }
      onDeleted(item.id)
    })
  }

  return (
    <TableRow className={cn(isBusy && 'opacity-60 transition-opacity')}>
      <TableCell>
        <input
          type="color"
          value={item.color}
          onChange={(e) => commitColor(e.target.value)}
          disabled={isBusy}
          aria-label={`Color for ${item.name}`}
          className="h-8 w-10 cursor-pointer rounded border bg-transparent"
        />
      </TableCell>
      <TableCell>
        <Input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ;(e.target as HTMLInputElement).blur()
            } else if (e.key === 'Escape') {
              setDraftName(item.name)
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          disabled={isBusy}
          className="h-8 text-sm"
        />
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
        {item.taskCount}
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={remove}
          disabled={isBusy}
          aria-label={`Delete ${item.name}`}
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

'use client'

// Shared table for categories + labels — same shape (name + color +
// taskCount), same interactions (inline edit + delete). The
// specialized service action (upsertCategory vs upsertLabel) is
// injected via the `onSave` / `onDelete` callbacks the parent
// binds.

import { useEffect, useState, useTransition } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
  // Centralized pending-delete state — one AlertDialog shared
  // across all rows in this section.
  const [pending, setPending] = useState<T | null>(null)
  const [isDeleting, startDelete] = useTransition()

  function confirmDelete() {
    if (!pending) return
    const target = pending
    startDelete(async () => {
      const res = await onDelete(target.id)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not delete')
        return
      }
      onDeleted(target.id)
      setPending(null)
    })
  }

  if (items.length === 0) {
    return (
      <p className="p-4 text-center text-xs text-muted-foreground">
        {emptyLabel}
      </p>
    )
  }

  return (
    <>
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
            onPatched={onPatched}
            onRequestDelete={() => setPending(item)}
          />
        ))}
      </TableBody>
    </Table>

    <AlertDialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) setPending(null)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &quot;{pending?.name}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            {pending && pending.taskCount > 0
              ? `"${pending.name}" is on ${pending.taskCount} task${pending.taskCount === 1 ? '' : 's'}. Deleting removes the association; the tasks themselves keep their history.`
              : 'This action cannot be undone.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}

function ItemRow<T extends TaxonomyItem>({
  item,
  onSave,
  onPatched,
  onRequestDelete,
}: {
  item: T
  onSave: CategoryLabelRowsProps<T>['onSave']
  onPatched: (next: T) => void
  onRequestDelete: () => void
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
          onClick={onRequestDelete}
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

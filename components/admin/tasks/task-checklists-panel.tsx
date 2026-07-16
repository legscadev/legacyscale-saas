'use client'

// Checklists panel for the task detail drawer. A task can hold
// multiple named checklists ("Pre-launch", "Handoff", etc.); each
// carries an ordered list of items with a done flag. All mutations
// are optimistic — patch local state, fire the server action, roll
// back + toast on error, bubble onChanged so the drawer's summary
// counts refresh.

import { useEffect, useRef, useState, useTransition } from 'react'
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

import {
  addChecklistItemAction,
  createChecklistAction,
  deleteChecklistAction,
  deleteChecklistItemAction,
  renameChecklistAction,
  updateChecklistItemAction,
} from '@/app/(admin)/admin/tasks/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type {
  ChecklistItemRow,
  ChecklistRow,
} from '@/lib/services/task-checklist-service'

interface TaskChecklistsPanelProps {
  taskId: string
  checklists: ChecklistRow[]
  onChanged?: () => void
}

export function TaskChecklistsPanel({
  taskId,
  checklists: initial,
  onChanged,
}: TaskChecklistsPanelProps) {
  const [checklists, setChecklists] = useState(initial)
  const initialSig = useRef(signatureOf(initial))
  const currentSig = signatureOf(initial)
  if (currentSig !== initialSig.current) {
    initialSig.current = currentSig
    setChecklists(initial)
  }

  function patchChecklist(id: string, next: ChecklistRow) {
    setChecklists((prev) => prev.map((c) => (c.id === id ? next : c)))
    onChanged?.()
  }
  function removeChecklist(id: string) {
    setChecklists((prev) => prev.filter((c) => c.id !== id))
    onChanged?.()
  }
  function addChecklist(row: ChecklistRow) {
    setChecklists((prev) => [...prev, row])
    onChanged?.()
  }

  return (
    <div className="space-y-3">
      {checklists.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
          No checklists yet. Add one below.
        </p>
      ) : (
        checklists.map((cl) => (
          <ChecklistBlock
            key={cl.id}
            checklist={cl}
            onPatch={(next) => patchChecklist(cl.id, next)}
            onRemove={() => removeChecklist(cl.id)}
          />
        ))
      )}
      <AddChecklistForm taskId={taskId} onAdded={addChecklist} />
    </div>
  )
}

// =========================================================
// Add-checklist form (inline expand)
// =========================================================

function AddChecklistForm({
  taskId,
  onAdded,
}: {
  taskId: string
  onAdded: (row: ChecklistRow) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState('')
  const [isSaving, startSave] = useTransition()

  function submit() {
    const title = draft.trim()
    if (!title) return
    startSave(async () => {
      const res = await createChecklistAction({ taskId, title })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not add checklist')
        return
      }
      // Server didn't return the full row (only { id }); synthesize
      // one optimistically. Refetch on close reconciles.
      onAdded({
        id: res.data.id,
        taskId,
        title,
        orderIndex: Date.now(),
        items: [],
      })
      setDraft('')
      setExpanded(false)
    })
  }

  if (!expanded) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(true)}
        className="w-full justify-start text-muted-foreground"
      >
        <Plus className="size-3.5" />
        Add checklist
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/20 p-2">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            submit()
          } else if (e.key === 'Escape') {
            setDraft('')
            setExpanded(false)
          }
        }}
        placeholder="Checklist name…"
        autoFocus
        disabled={isSaving}
        className="h-8 text-sm"
      />
      <Button size="sm" onClick={submit} disabled={isSaving || !draft.trim()}>
        {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : 'Add'}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setDraft('')
          setExpanded(false)
        }}
        disabled={isSaving}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  )
}

// =========================================================
// Single checklist
// =========================================================

interface ChecklistBlockProps {
  checklist: ChecklistRow
  onPatch: (next: ChecklistRow) => void
  onRemove: () => void
}

function ChecklistBlock({
  checklist,
  onPatch,
  onRemove,
}: ChecklistBlockProps) {
  const total = checklist.items.length
  const done = checklist.items.filter((i) => i.isDone).length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="space-y-2 rounded-md border p-2">
      <div className="flex items-center gap-2">
        <ChecklistTitle
          checklist={checklist}
          onPatch={(patch) => onPatch({ ...checklist, ...patch })}
        />
        <DeleteChecklistButton
          checklistId={checklist.id}
          onDeleted={onRemove}
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              pct === 100 ? 'bg-emerald-500' : 'bg-primary',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
          {done}/{total}
        </span>
      </div>

      <ul className="space-y-1">
        {checklist.items.map((item) => (
          <ChecklistItem
            key={item.id}
            item={item}
            onPatch={(patch) =>
              onPatch({
                ...checklist,
                items: checklist.items.map((i) =>
                  i.id === item.id ? { ...i, ...patch } : i,
                ),
              })
            }
            onDeleted={() =>
              onPatch({
                ...checklist,
                items: checklist.items.filter((i) => i.id !== item.id),
              })
            }
          />
        ))}
      </ul>

      <AddChecklistItemForm
        checklistId={checklist.id}
        onAdded={(row) =>
          onPatch({
            ...checklist,
            items: [...checklist.items, row],
          })
        }
      />
    </div>
  )
}

// =========================================================
// Checklist title (rename)
// =========================================================

function ChecklistTitle({
  checklist,
  onPatch,
}: {
  checklist: ChecklistRow
  onPatch: (patch: Partial<ChecklistRow>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(checklist.title)
  const [isSaving, startSave] = useTransition()

  useEffect(() => setDraft(checklist.title), [checklist.title])

  function commit() {
    const next = draft.trim()
    if (!next || next === checklist.title) {
      setDraft(checklist.title)
      setEditing(false)
      return
    }
    startSave(async () => {
      const res = await renameChecklistAction({
        checklistId: checklist.id,
        title: next,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not rename checklist')
        setDraft(checklist.title)
        setEditing(false)
        return
      }
      onPatch({ title: next })
      setEditing(false)
    })
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex-1 truncate text-left text-sm font-medium hover:text-primary"
      >
        {checklist.title}
      </button>
    )
  }

  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        } else if (e.key === 'Escape') {
          setDraft(checklist.title)
          setEditing(false)
        }
      }}
      disabled={isSaving}
      autoFocus
      className="h-7 flex-1 text-sm font-medium"
    />
  )
}

function DeleteChecklistButton({
  checklistId,
  onDeleted,
}: {
  checklistId: string
  onDeleted: () => void
}) {
  const [isBusy, startBusy] = useTransition()
  function remove() {
    if (!confirm('Delete this checklist and all its items?')) return
    startBusy(async () => {
      const res = await deleteChecklistAction(checklistId)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not delete checklist')
        return
      }
      onDeleted()
    })
  }
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      onClick={remove}
      disabled={isBusy}
      aria-label="Delete checklist"
      className="text-muted-foreground hover:text-destructive"
    >
      <Trash2 className="size-3.5" />
    </Button>
  )
}

// =========================================================
// Checklist item row
// =========================================================

interface ChecklistItemProps {
  item: ChecklistItemRow
  onPatch: (patch: Partial<ChecklistItemRow>) => void
  onDeleted: () => void
}

function ChecklistItem({ item, onPatch, onDeleted }: ChecklistItemProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.text)
  const [isBusy, startBusy] = useTransition()

  useEffect(() => setDraft(item.text), [item.text])

  function toggle() {
    const next = !item.isDone
    onPatch({ isDone: next }) // optimistic
    startBusy(async () => {
      const res = await updateChecklistItemAction({
        itemId: item.id,
        isDone: next,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not update item')
        onPatch({ isDone: !next })
      }
    })
  }

  function saveText() {
    const next = draft.trim()
    if (!next || next === item.text) {
      setDraft(item.text)
      setEditing(false)
      return
    }
    startBusy(async () => {
      const res = await updateChecklistItemAction({
        itemId: item.id,
        text: next,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not update item')
        setDraft(item.text)
        setEditing(false)
        return
      }
      onPatch({ text: next })
      setEditing(false)
    })
  }

  function remove() {
    startBusy(async () => {
      const res = await deleteChecklistItemAction(item.id)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not delete item')
        return
      }
      onDeleted()
    })
  }

  return (
    <li className="group/item flex items-start gap-2 rounded px-1 py-0.5 hover:bg-muted/30">
      <button
        type="button"
        onClick={toggle}
        disabled={isBusy}
        aria-label={item.isDone ? 'Mark as not done' : 'Mark as done'}
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors',
          item.isDone
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : 'border-input hover:border-primary/50',
        )}
      >
        {item.isDone ? <Check className="size-3" /> : null}
      </button>
      {editing ? (
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={saveText}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              saveText()
            } else if (e.key === 'Escape') {
              setDraft(item.text)
              setEditing(false)
            }
          }}
          autoFocus
          disabled={isBusy}
          className="h-7 flex-1 text-sm"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={cn(
            'min-w-0 flex-1 truncate text-left text-sm',
            item.isDone && 'text-muted-foreground line-through',
          )}
        >
          {item.text}
        </button>
      )}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/item:opacity-100">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => setEditing(true)}
          disabled={isBusy || editing}
          aria-label="Edit item"
        >
          <Pencil className="size-3" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={remove}
          disabled={isBusy}
          aria-label="Delete item"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-3" />
        </Button>
      </div>
    </li>
  )
}

// =========================================================
// Add item form
// =========================================================

function AddChecklistItemForm({
  checklistId,
  onAdded,
}: {
  checklistId: string
  onAdded: (row: ChecklistItemRow) => void
}) {
  const [draft, setDraft] = useState('')
  const [isSaving, startSave] = useTransition()

  function submit() {
    const text = draft.trim()
    if (!text) return
    startSave(async () => {
      const res = await addChecklistItemAction({ checklistId, text })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not add item')
        return
      }
      onAdded({
        id: res.data.id,
        text,
        isDone: false,
        doneBy: null,
        doneAt: null,
        orderIndex: Date.now(),
      })
      setDraft('')
    })
  }

  return (
    <div className="flex items-center gap-2 pt-1">
      <Plus className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            submit()
          }
        }}
        placeholder="Add an item…"
        disabled={isSaving}
        className="h-7 flex-1 text-sm"
      />
      {draft.trim() ? (
        <Button size="sm" onClick={submit} disabled={isSaving}>
          {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : 'Add'}
        </Button>
      ) : null}
    </div>
  )
}

// =========================================================
// Helpers
// =========================================================

function signatureOf(rows: ChecklistRow[]): string {
  return rows
    .map(
      (c) =>
        `${c.id}:${c.title}:${c.items.length}:${c.items
          .map((i) => (i.isDone ? '1' : '0'))
          .join('')}`,
    )
    .join('|')
}

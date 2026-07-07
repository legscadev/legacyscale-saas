'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/shared'
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
import { cn } from '@/lib/utils'
import type { ChecklistItem } from '@/lib/services/checklist-service'

import {
  addChecklistItemAction,
  deleteChecklistItemAction,
  getDeleteChecklistItemImpactAction,
  moveChecklistItemAction,
  updateChecklistItemFieldsAction,
} from '@/app/(admin)/admin/onboarding/actions'

interface ChecklistEditorProps {
  initialItems: ChecklistItem[]
}

const BACK_HREF = '/admin/onboarding'

export function ChecklistEditor({ initialItems }: ChecklistEditorProps) {
  const [items, setItems] = useState<ChecklistItem[]>(initialItems)
  const [pending, startTransition] = useTransition()
  const [newItemLabel, setNewItemLabel] = useState('')
  const [deleteState, setDeleteState] = useState<{
    itemId: string
    label: string
    statusCount: number
    affectedEmployeeCount: number
  } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const sortableIds = useMemo(() => items.map((i) => i.id), [items])

  function addItem(e: React.FormEvent) {
    e.preventDefault()
    const label = newItemLabel.trim()
    if (!label) return
    startTransition(async () => {
      try {
        const next = await addChecklistItemAction({ label })
        setItems(next)
        setNewItemLabel('')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to add')
      }
    })
  }

  const renameItem = useCallback(
    (itemId: string, label: string, prev: string) => {
      if (label.trim() === prev) return
      startTransition(async () => {
        try {
          const next = await updateChecklistItemFieldsAction(itemId, {
            label: label.trim(),
          })
          setItems(next)
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Failed to rename')
        }
      })
    },
    [],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = items.findIndex((i) => i.id === active.id)
      const newIndex = items.findIndex((i) => i.id === over.id)
      if (oldIndex < 0 || newIndex < 0) return

      // Optimistic reorder — the drop feels instant. On server error
      // we snap back to the previous order so the UI matches truth.
      const previous = items
      const nextItems = arrayMove(items, oldIndex, newIndex)
      setItems(nextItems)

      void (async () => {
        try {
          const rows = await moveChecklistItemAction(String(active.id), {
            targetIndex: newIndex,
          })
          setItems(rows)
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Failed to move')
          setItems(previous)
        }
      })()
    },
    [items],
  )

  async function askDelete(itemId: string) {
    try {
      const impact = await getDeleteChecklistItemImpactAction(itemId)
      setDeleteState({
        itemId,
        label: impact.itemLabel,
        statusCount: impact.statusCount,
        affectedEmployeeCount: impact.affectedEmployeeCount,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load impact')
    }
  }

  function confirmDelete() {
    if (!deleteState) return
    const { itemId, label } = deleteState
    startTransition(async () => {
      try {
        const next = await deleteChecklistItemAction(itemId)
        setItems(next)
        toast.success(`Deleted "${label}"`)
        setDeleteState(null)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete')
      }
    })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={[
          { label: 'Onboarding', href: BACK_HREF },
          { label: 'Checklist' },
        ]}
        title="Onboarding checklist"
        description="Edit the shared checklist. Every employee sees the same items — changes reflect on all attached profiles immediately."
      />

      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <h2 className="text-sm font-semibold">
            Items ({items.length})
          </h2>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Drag to reorder · click label to rename · trash removes
          </span>
        </div>
        {items.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            No items yet. Add one below.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortableIds}
              strategy={verticalListSortingStrategy}
            >
              <ul className="divide-y">
                {items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    disabled={pending}
                    onRename={(label) => renameItem(item.id, label, item.label)}
                    onDelete={() => askDelete(item.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
        <form
          onSubmit={addItem}
          className="flex items-center gap-2 border-t px-3 py-2"
        >
          <Input
            value={newItemLabel}
            onChange={(e) => setNewItemLabel(e.target.value)}
            placeholder="Add new item (e.g. Slack access)"
            disabled={pending}
            className="h-8"
          />
          <Button
            type="submit"
            size="sm"
            disabled={pending || !newItemLabel.trim()}
          >
            <Plus className="mr-1 size-4" />
            Add
          </Button>
        </form>
      </div>

      <AlertDialog
        open={deleteState !== null}
        onOpenChange={(v) => !v && setDeleteState(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &ldquo;{deleteState?.label}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteState?.statusCount === 0
                ? 'No employee has touched this item yet — safe to remove.'
                : `This will delete ${deleteState?.statusCount} status entr${
                    deleteState?.statusCount === 1 ? 'y' : 'ies'
                  } across ${deleteState?.affectedEmployeeCount} employee${
                    deleteState?.affectedEmployeeCount === 1 ? '' : 's'
                  }. This can't be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pending ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                'Delete item'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ItemRow({
  item,
  disabled,
  onRename,
  onDelete,
}: {
  item: ChecklistItem
  disabled: boolean
  onRename: (label: string) => void
  onDelete: () => void
}) {
  const [draft, setDraft] = useState(item.label)
  const [editing, setEditing] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.85 : 1,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-1.5 bg-card px-2 py-1 hover:bg-muted/30',
        isDragging && 'shadow-md',
      )}
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none rounded p-0.5 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30"
        disabled={disabled}
      >
        <GripVertical className="size-3.5" />
      </button>
      {editing ? (
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setEditing(false)
            onRename(draft)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur()
            } else if (e.key === 'Escape') {
              setDraft(item.label)
              setEditing(false)
            }
          }}
          className="h-7 text-sm"
        />
      ) : (
        <button
          type="button"
          className="flex-1 truncate text-left text-sm hover:text-primary"
          onClick={() => setEditing(true)}
          title="Click to rename"
        >
          {item.label}
          {item.statusCount > 0 ? (
            <span className="ml-1.5 text-[10px] text-muted-foreground">
              · {item.statusCount}
            </span>
          ) : null}
        </button>
      )}
      <button
        type="button"
        className={cn(
          'grid size-6 place-items-center rounded text-muted-foreground/60 transition-colors',
          'hover:bg-muted hover:text-destructive',
          'opacity-0 group-hover:opacity-100 disabled:opacity-30',
        )}
        onClick={onDelete}
        disabled={disabled}
        aria-label="Delete"
      >
        <Trash2 className="size-3" />
      </button>
    </li>
  )
}

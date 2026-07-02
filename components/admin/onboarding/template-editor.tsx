'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
import {
  GripVertical,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { TemplateDetail } from '@/lib/services/checklist-template-service'

import {
  addTemplateItemAction,
  deleteTemplateAction,
  deleteTemplateItemAction,
  getDeleteItemImpactAction,
  getTemplateDetailAction,
  moveTemplateItemAction,
  updateTemplateAction,
  updateTemplateItemAction,
} from '@/app/(admin)/admin/onboarding/actions'

interface TemplateEditorProps {
  initialDetail: TemplateDetail
}

// Query param used when navigating back to /admin/onboarding so the
// list lands on the Checklists tab instead of resetting to Active.
const BACK_HREF = '/admin/onboarding?tab=checklists'

export function TemplateEditor({ initialDetail }: TemplateEditorProps) {
  const router = useRouter()
  const [detail, setDetail] = useState<TemplateDetail>(initialDetail)
  const [pending, startTransition] = useTransition()

  const [nameDraft, setNameDraft] = useState(initialDetail.name)
  const [descDraft, setDescDraft] = useState(initialDetail.description ?? '')
  const [defaultDraft, setDefaultDraft] = useState(initialDetail.isDefault)
  const [savingHeader, setSavingHeader] = useState(false)

  const [newItemLabel, setNewItemLabel] = useState('')
  const [deleteState, setDeleteState] = useState<{
    itemId: string
    label: string
    statusCount: number
    affectedEmployeeCount: number
  } | null>(null)
  const [deleteTemplateOpen, setDeleteTemplateOpen] = useState(false)

  // Fresh fetch after any mutation so counts + item order stay
  // consistent. Uses the cancelled-flag pattern to be safe against
  // rapid successive edits.
  const refresh = useCallback(() => {
    let cancelled = false
    getTemplateDetailAction(detail.id)
      .then((data) => {
        if (cancelled) return
        setDetail(data)
        setNameDraft(data.name)
        setDescDraft(data.description ?? '')
        setDefaultDraft(data.isDefault)
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to reload template')
      })
    return () => {
      cancelled = true
    }
  }, [detail.id])

  function saveHeader() {
    if (
      nameDraft.trim() === detail.name &&
      (descDraft || null) === (detail.description || null) &&
      defaultDraft === detail.isDefault
    ) {
      return
    }
    setSavingHeader(true)
    startTransition(async () => {
      try {
        await updateTemplateAction(detail.id, {
          name: nameDraft.trim(),
          description: descDraft.trim() || null,
          isDefault: defaultDraft,
        })
        toast.success('Template updated')
        refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save')
      } finally {
        setSavingHeader(false)
      }
    })
  }

  function addItem(e: React.FormEvent) {
    e.preventDefault()
    if (!newItemLabel.trim()) return
    startTransition(async () => {
      try {
        await addTemplateItemAction(detail.id, { label: newItemLabel.trim() })
        setNewItemLabel('')
        refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to add')
      }
    })
  }

  function renameItem(itemId: string, label: string, prev: string) {
    if (label.trim() === prev) return
    startTransition(async () => {
      try {
        await updateTemplateItemAction(itemId, { label: label.trim() })
        refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to rename')
      }
    })
  }

  // dnd-kit sensors — Pointer for mouse/touch, Keyboard for a11y.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Small distance threshold so a click-on-label doesn't kick off
      // a drag by accident.
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const sortableIds = useMemo(
    () => detail.items.map((i) => i.id),
    [detail.items],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = detail.items.findIndex((i) => i.id === active.id)
      const newIndex = detail.items.findIndex((i) => i.id === over.id)
      if (oldIndex < 0 || newIndex < 0) return

      // Optimistic reorder — the drop feels instant. On server error
      // we snap back to the previous order so the UI matches truth.
      const previous = detail.items
      const nextItems = arrayMove(detail.items, oldIndex, newIndex)
      setDetail({ ...detail, items: nextItems })

      void (async () => {
        try {
          await moveTemplateItemAction(String(active.id), {
            targetIndex: newIndex,
          })
          refresh()
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Failed to move')
          setDetail({ ...detail, items: previous })
        }
      })()
    },
    [detail, refresh],
  )

  async function askDelete(itemId: string) {
    try {
      const impact = await getDeleteItemImpactAction(itemId)
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
        await deleteTemplateItemAction(itemId)
        toast.success(`Deleted "${label}"`)
        setDeleteState(null)
        refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete')
      }
    })
  }

  function confirmDeleteTemplate() {
    startTransition(async () => {
      try {
        await deleteTemplateAction(detail.id)
        toast.success('Template deleted')
        setDeleteTemplateOpen(false)
        router.push(BACK_HREF)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete')
      }
    })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={[
          { label: 'Onboarding', href: '/admin/onboarding' },
          { label: 'Checklists', href: BACK_HREF },
          { label: detail.name },
        ]}
        title={detail.name}
        description={
          detail.description ?? 'Edit checklist items. Changes reflect on every attached employee.'
        }
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            {detail.isDefault ? 'Default template · ' : null}
            {detail.employeeCount} employee
            {detail.employeeCount === 1 ? '' : 's'} attached
          </span>
        }
        actions={
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            disabled={pending}
            onClick={() => setDeleteTemplateOpen(true)}
          >
            <Trash2 className="mr-1.5 size-4" />
            Delete template
          </Button>
        }
      />

      {/* Header edit form */}
      <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="tpl-edit-name">Name</Label>
          <Input
            id="tpl-edit-name"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={saveHeader}
          />
        </div>
        <div className="space-y-1.5 sm:row-span-2">
          <Label htmlFor="tpl-edit-desc">Description</Label>
          <Textarea
            id="tpl-edit-desc"
            rows={3}
            value={descDraft}
            onChange={(e) => setDescDraft(e.target.value)}
            onBlur={saveHeader}
            placeholder="What this checklist is for"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 rounded border-input"
            checked={defaultDraft}
            onChange={(e) => {
              setDefaultDraft(e.target.checked)
              setTimeout(saveHeader, 0)
            }}
          />
          Default template for new employees
        </label>
        {savingHeader ? (
          <p className="text-xs text-muted-foreground sm:col-span-2">Saving…</p>
        ) : null}
      </div>

      {/* Items */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <h2 className="text-sm font-semibold">
            Items ({detail.items.length})
          </h2>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Drag to reorder · click label to rename · trash removes
          </span>
        </div>
        {detail.items.length === 0 ? (
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
                {detail.items.map((item) => (
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

      {/* Per-item delete confirmation with impact preview */}
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

      {/* Whole-template delete confirmation */}
      <AlertDialog
        open={deleteTemplateOpen}
        onOpenChange={setDeleteTemplateOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              {detail.employeeCount === 0
                ? 'No employees are attached — safe to remove.'
                : `${detail.employeeCount} employee${
                    detail.employeeCount === 1 ? '' : 's'
                  } will be detached (their profile will show "No checklist template assigned"). All items and status history for this template will be permanently removed.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteTemplate}
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pending ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                'Delete template'
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
  item: TemplateDetail['items'][number]
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
    // Slight pop while dragging so the row lifts above its neighbours.
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

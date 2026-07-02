'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Copy,
  Loader2,
  Pencil,
  Plus,
  Star,
  Trash2,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/shared'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type {
  TemplateDetail,
  TemplateListItem,
} from '@/lib/services/checklist-template-service'

import {
  addTemplateItemAction,
  createTemplateAction,
  deleteTemplateAction,
  deleteTemplateItemAction,
  getDeleteItemImpactAction,
  getTemplateDetailAction,
  moveTemplateItemAction,
  updateTemplateAction,
  updateTemplateItemAction,
} from '@/app/(admin)/admin/onboarding/actions'

interface ChecklistsTabProps {
  templates: TemplateListItem[]
}

export function ChecklistsTab({ templates }: ChecklistsTabProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Reusable checklist definitions. Every employee gets attached to one
          — edits here update every attached profile.
        </p>
        <Button size="sm" onClick={() => setNewOpen(true)}>
          <Plus className="mr-1.5 size-4" />
          New template
        </Button>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          icon={Copy}
          tone="brand"
          title="No templates yet"
          description="Create a checklist template so every new hire starts from the same set of tasks."
        >
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="mr-1.5 size-4" />
            New template
          </Button>
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <li key={t.id}>
              <TemplateCard template={t} onOpen={() => setSelectedId(t.id)} />
            </li>
          ))}
        </ul>
      )}

      <NewTemplateDialog open={newOpen} onOpenChange={setNewOpen} />
      {selectedId ? (
        <TemplateEditorDialog
          templateId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  )
}

function TemplateCard({
  template,
  onOpen,
}: {
  template: TemplateListItem
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group flex w-full flex-col rounded-xl border bg-card p-4 text-left transition-all',
        'hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-semibold">{template.name}</h3>
            {template.isDefault ? (
              <Star className="size-3.5 fill-amber-400 text-amber-500" />
            ) : null}
          </div>
          {template.description ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {template.description}
            </p>
          ) : (
            <p className="mt-1 text-sm italic text-muted-foreground">
              No description
            </p>
          )}
        </div>
        <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>
      <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Copy className="size-3" />
          {template.itemCount} items
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="size-3" />
          {template.employeeCount} employees
        </span>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------
// New template dialog
// ---------------------------------------------------------------------

function NewTemplateDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [pending, startTransition] = useTransition()

  function reset() {
    setName('')
    setDescription('')
    setIsDefault(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return
    startTransition(async () => {
      try {
        await createTemplateAction({
          name,
          description: description || null,
          isDefault,
        })
        toast.success(`Created ${name}`)
        reset()
        onOpenChange(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to create')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New checklist template</DialogTitle>
          <DialogDescription>
            Create a named checklist. You&apos;ll add items in the next step.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">Name</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Setter Onboarding"
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-description">Description (optional)</Label>
            <Textarea
              id="tpl-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this checklist is for"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 rounded border-input"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            Make this the default template for new employees
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Creating…
                </>
              ) : (
                'Create template'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------
// Template editor dialog
// ---------------------------------------------------------------------

function TemplateEditorDialog({
  templateId,
  onClose,
}: {
  templateId: string
  onClose: () => void
}) {
  // We fetch fresh detail on open — the card only has counts, we need
  // the full item list to edit.
  const [detail, setDetail] = useState<TemplateDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()
  const [nameDraft, setNameDraft] = useState('')
  const [descDraft, setDescDraft] = useState('')
  const [defaultDraft, setDefaultDraft] = useState(false)
  const [savingHeader, setSavingHeader] = useState(false)
  const [newItemLabel, setNewItemLabel] = useState('')
  const [deleteState, setDeleteState] = useState<{
    itemId: string
    label: string
    statusCount: number
    affectedEmployeeCount: number
  } | null>(null)
  const [deleteTemplateOpen, setDeleteTemplateOpen] = useState(false)

  // Refresh is called imperatively after mutations. It uses the
  // "cancelled on unmount" pattern so a slow response can't set
  // state after the dialog has closed.
  const refresh = useCallback(() => {
    let cancelled = false
    getTemplateDetailAction(templateId)
      .then((data) => {
        if (cancelled) return
        setDetail(data)
        setNameDraft(data.name)
        setDescDraft(data.description ?? '')
        setDefaultDraft(data.isDefault)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          toast.error('Failed to load template')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [templateId])

  // Kick off the initial load. All state writes happen inside the
  // promise callback (post-await), which the purity lint accepts.
  useEffect(() => {
    return refresh()
  }, [refresh])

  function saveHeader() {
    if (!detail) return
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
        await updateTemplateAction(templateId, {
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
        await addTemplateItemAction(templateId, { label: newItemLabel.trim() })
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

  function moveItem(itemId: string, targetIndex: number) {
    startTransition(async () => {
      try {
        await moveTemplateItemAction(itemId, { targetIndex })
        refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to move')
      }
    })
  }

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
        await deleteTemplateAction(templateId)
        toast.success('Template deleted')
        setDeleteTemplateOpen(false)
        onClose()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete')
      }
    })
  }

  return (
    <>
      <Dialog open onOpenChange={(v) => !v && !pending && onClose()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit checklist template</DialogTitle>
            <DialogDescription>
              Changes to items are reflected on every employee attached to
              this template.
            </DialogDescription>
          </DialogHeader>

          {loading || !detail ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <div className="space-y-5">
              {/* Header edit */}
              <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-edit-name">Name</Label>
                  <Input
                    id="tpl-edit-name"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={saveHeader}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-edit-desc">Description</Label>
                  <Textarea
                    id="tpl-edit-desc"
                    rows={2}
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
                      // Save immediately — the boolean has no draft state
                      // that a blur handler would sync.
                      setTimeout(saveHeader, 0)
                    }}
                  />
                  Default template for new employees
                </label>
                {savingHeader ? (
                  <p className="text-xs text-muted-foreground">Saving…</p>
                ) : null}
              </div>

              {/* Items */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-semibold">
                    Items ({detail.items.length})
                  </h4>
                  <span className="text-xs text-muted-foreground">
                    {detail.employeeCount} employee
                    {detail.employeeCount === 1 ? '' : 's'} attached
                  </span>
                </div>
                {detail.items.length === 0 ? (
                  <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
                    No items yet. Add one below.
                  </p>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {detail.items.map((item, idx) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        canUp={idx > 0}
                        canDown={idx < detail.items.length - 1}
                        disabled={pending}
                        onRename={(label) => renameItem(item.id, label, item.label)}
                        onUp={() => moveItem(item.id, idx - 1)}
                        onDown={() => moveItem(item.id, idx + 1)}
                        onDelete={() => askDelete(item.id)}
                      />
                    ))}
                  </ul>
                )}

                <form onSubmit={addItem} className="mt-3 flex items-center gap-2">
                  <Input
                    value={newItemLabel}
                    onChange={(e) => setNewItemLabel(e.target.value)}
                    placeholder="Add new item (e.g. Slack access)"
                    disabled={pending}
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
            </div>
          )}

          <DialogFooter className="justify-between sm:justify-between">
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={pending || !detail}
              onClick={() => setDeleteTemplateOpen(true)}
            >
              <Trash2 className="mr-1.5 size-4" />
              Delete template
            </Button>
            <Button variant="outline" onClick={onClose} disabled={pending}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
      <AlertDialog open={deleteTemplateOpen} onOpenChange={setDeleteTemplateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              {detail?.employeeCount === 0
                ? 'No employees are attached — safe to remove.'
                : `${detail?.employeeCount} employee${
                    detail?.employeeCount === 1 ? '' : 's'
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
    </>
  )
}

function ItemRow({
  item,
  canUp,
  canDown,
  disabled,
  onRename,
  onUp,
  onDown,
  onDelete,
}: {
  item: TemplateDetail['items'][number]
  canUp: boolean
  canDown: boolean
  disabled: boolean
  onRename: (label: string) => void
  onUp: () => void
  onDown: () => void
  onDelete: () => void
}) {
  const [draft, setDraft] = useState(item.label)
  const [editing, setEditing] = useState(false)

  return (
    <li className="flex items-center gap-2 px-3 py-2">
      <div className="flex flex-col">
        <button
          type="button"
          className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
          onClick={onUp}
          disabled={!canUp || disabled}
          aria-label="Move up"
        >
          <ArrowUp className="size-3" />
        </button>
        <button
          type="button"
          className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
          onClick={onDown}
          disabled={!canDown || disabled}
          aria-label="Move down"
        >
          <ArrowDown className="size-3" />
        </button>
      </div>
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
          className="h-8"
        />
      ) : (
        <button
          type="button"
          className="flex-1 truncate text-left text-sm hover:text-primary"
          onClick={() => setEditing(true)}
        >
          {item.label}
          {item.statusCount > 0 ? (
            <span className="ml-2 text-xs text-muted-foreground">
              · {item.statusCount} status
              {item.statusCount === 1 ? '' : 'es'}
            </span>
          ) : null}
        </button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={() => setEditing(true)}
        disabled={disabled}
        aria-label="Rename"
      >
        <Pencil className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
        disabled={disabled}
        aria-label="Delete"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </li>
  )
}

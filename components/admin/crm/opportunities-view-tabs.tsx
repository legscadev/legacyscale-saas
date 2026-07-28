'use client'

// Saved-view tab strip that lives above the Filters chip row on the
// Opportunities board. Left tab is always "All" (no filter). Right
// side gets a "+ Save current" button that opens a name-prompt
// dialog. Each saved tab has a small kebab for Rename / Overwrite
// filter / Delete.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import {
  createOpportunityViewAction,
  deleteOpportunityViewAction,
  renameOpportunityViewAction,
  updateOpportunityViewFilterAction,
} from '@/app/(admin)/admin/crm/opportunities/actions'
import type { OpportunityViewRow } from '@/lib/services/crm-opportunity-view-service'

import {
  countActiveFilters,
  EMPTY_FILTER,
  type OpportunityFilterState,
} from './opportunities-filter-drawer'

interface OpportunitiesViewTabsProps {
  views: OpportunityViewRow[]
  activeViewId: string | null
  currentFilter: OpportunityFilterState
  onSelect: (viewId: string | null, filter: OpportunityFilterState) => void
  /** Called after any mutation lands so the shell can refresh. */
  onChanged: () => void
}

export function OpportunitiesViewTabs({
  views,
  activeViewId,
  currentFilter,
  onSelect,
  onChanged,
}: OpportunitiesViewTabsProps) {
  const router = useRouter()
  const [pending, startOp] = useTransition()

  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [renameFor, setRenameFor] = useState<OpportunityViewRow | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteFor, setDeleteFor] = useState<OpportunityViewRow | null>(null)

  const activeCount = countActiveFilters(currentFilter)
  const canSave = activeCount > 0

  function submitSave(e: React.FormEvent) {
    e.preventDefault()
    const name = saveName.trim()
    if (!name) return
    startOp(async () => {
      const res = await createOpportunityViewAction({
        name,
        filter: currentFilter,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not save view')
        return
      }
      toast.success(`Saved “${name}”`)
      setSaveName('')
      setSaveOpen(false)
      onSelect(res.data.id, currentFilter)
      onChanged()
      router.refresh()
    })
  }

  function submitRename(e: React.FormEvent) {
    e.preventDefault()
    if (!renameFor) return
    const name = renameValue.trim()
    if (!name) return
    startOp(async () => {
      const res = await renameOpportunityViewAction({
        viewId: renameFor.id,
        name,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not rename view')
        return
      }
      toast.success('View renamed')
      setRenameFor(null)
      onChanged()
      router.refresh()
    })
  }

  function overwrite(view: OpportunityViewRow) {
    startOp(async () => {
      const res = await updateOpportunityViewFilterAction({
        viewId: view.id,
        filter: currentFilter,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not update view')
        return
      }
      toast.success(`Updated “${view.name}”`)
      onChanged()
      router.refresh()
    })
  }

  function confirmDelete() {
    if (!deleteFor) return
    startOp(async () => {
      const res = await deleteOpportunityViewAction(deleteFor.id)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not delete view')
        return
      }
      toast.success('View deleted')
      // If the deleted view was active, drop back to "All".
      if (activeViewId === deleteFor.id) onSelect(null, EMPTY_FILTER)
      setDeleteFor(null)
      onChanged()
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex items-center gap-1 border-b text-sm">
        <TabButton
          label="All"
          isActive={activeViewId === null}
          onClick={() => onSelect(null, EMPTY_FILTER)}
        />
        {views.map((view) => (
          <SavedTab
            key={view.id}
            view={view}
            isActive={activeViewId === view.id}
            disabled={pending}
            onSelect={() =>
              onSelect(view.id, coerceFilter(view.filter))
            }
            onRename={() => {
              setRenameValue(view.name)
              setRenameFor(view)
            }}
            onOverwrite={() => overwrite(view)}
            onDelete={() => setDeleteFor(view)}
          />
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="ml-1 h-8"
          disabled={!canSave || pending}
          onClick={() => setSaveOpen(true)}
        >
          <Plus className="size-3.5" />
          Save current
        </Button>
      </div>

      {/* Save-as dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={submitSave}>
            <DialogHeader>
              <DialogTitle>Save as new list</DialogTitle>
              <DialogDescription>
                Name this filter set — you’ll be able to re-apply it
                from the tab strip. Views are private to you.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5 py-4">
              <Label htmlFor="view-save-name">Name</Label>
              <Input
                id="view-save-name"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="e.g. My open enterprise"
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSaveOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !saveName.trim()}>
                {pending ? 'Saving…' : 'Save view'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={renameFor !== null} onOpenChange={(o) => !o && setRenameFor(null)}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={submitRename}>
            <DialogHeader>
              <DialogTitle>Rename view</DialogTitle>
            </DialogHeader>
            <div className="grid gap-1.5 py-4">
              <Label htmlFor="view-rename-input">Name</Label>
              <Input
                id="view-rename-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameFor(null)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteFor !== null} onOpenChange={(o) => !o && setDeleteFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteFor?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The view will be removed from your tab strip. Deals
              themselves are unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmDelete()
              }}
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function TabButton({
  label,
  isActive,
  onClick,
}: {
  label: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
        isActive
          ? 'border-primary text-foreground'
          : 'border-transparent text-muted-foreground hover:border-muted hover:text-foreground',
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      {label}
    </button>
  )
}

interface SavedTabProps {
  view: OpportunityViewRow
  isActive: boolean
  disabled: boolean
  onSelect: () => void
  onRename: () => void
  onOverwrite: () => void
  onDelete: () => void
}

function SavedTab({
  view,
  isActive,
  disabled,
  onSelect,
  onRename,
  onOverwrite,
  onDelete,
}: SavedTabProps) {
  return (
    <div
      className={cn(
        '-mb-px flex items-center border-b-2 transition-colors',
        isActive
          ? 'border-primary text-foreground'
          : 'border-transparent text-muted-foreground hover:border-muted hover:text-foreground',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="py-2.5 pl-4 pr-1 text-sm font-medium"
        aria-current={isActive ? 'page' : undefined}
      >
        {view.name}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Actions for ${view.name}`}
          render={
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-md text-current"
              disabled={disabled}
            />
          }
        >
          <MoreVertical className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={onRename}>
            <Pencil className="size-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOverwrite}>
            <Save className="size-4" />
            Overwrite filters
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/** Best-effort narrowing of the stored JSON blob → OpportunityFilterState.
 *  Missing fields fall back to their empty defaults so a corrupted /
 *  outdated payload doesn't blow up the shell. */
function coerceFilter(raw: unknown): OpportunityFilterState {
  const obj = (raw ?? {}) as Partial<OpportunityFilterState>
  return {
    stageIds: Array.isArray(obj.stageIds) ? obj.stageIds : [],
    statuses: Array.isArray(obj.statuses) ? obj.statuses : [],
    assigneeIds: Array.isArray(obj.assigneeIds) ? obj.assigneeIds : [],
    valueMin: typeof obj.valueMin === 'string' ? obj.valueMin : '',
    valueMax: typeof obj.valueMax === 'string' ? obj.valueMax : '',
    closeDateFrom: typeof obj.closeDateFrom === 'string' ? obj.closeDateFrom : '',
    closeDateTo: typeof obj.closeDateTo === 'string' ? obj.closeDateTo : '',
  }
}

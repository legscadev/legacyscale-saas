'use client'

// Smart Lists tab row above the Contacts table (GHL parity). Each
// tab is a saved filter/sort snapshot the owner can jump back to;
// "All" is the built-in tab with no filters. Clicking a tab
// navigates to a URL that reproduces the saved filter shape.
//
// Actions (Save current, Rename, Delete) go through the
// crmContactViewService — private per owner in P0.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bookmark, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  createContactViewAction,
  deleteContactViewAction,
  renameContactViewAction,
  updateContactViewFilterAction,
} from '@/app/(admin)/admin/crm/leads/actions'
import { Button } from '@/components/ui/button'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import type { ContactViewRow } from '@/lib/services/crm-contact-view-service'

interface Props {
  basePath: string
  views: ContactViewRow[]
  /** Active saved view id (URL `?view=…`), or null when on "All". */
  activeViewId: string | null
  /** Current filter state (from parseContactsFilterFromParams +
   *  extras like search / sort / per-page) — payload for save. */
  currentFilter: Record<string, unknown>
  /** Serialised query string of active filters — powers deep-links
   *  when jumping between tabs. Excludes `view` + `page`. */
  currentQuery: string
  /** True if any filter/sort differs from the built-in "All" view.
   *  Powers the Save-as button visibility. */
  isDirty: boolean
}

export function ContactsViewTabs({
  basePath,
  views,
  activeViewId,
  currentFilter,
  currentQuery,
  isDirty,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<ContactViewRow | null>(null)
  const [newViewName, setNewViewName] = useState('')

  function jumpToView(view: ContactViewRow | null) {
    if (!view) {
      router.push(basePath)
      return
    }
    // Rehydrate saved filter into URL params via the service's blob;
    // shape mirrors what parseContactsFilterFromParams produced on save.
    const params = new URLSearchParams()
    const filter = view.filter as Record<string, unknown>
    for (const [key, value] of Object.entries(filter)) {
      const short = SHORT_KEY[key] ?? key
      if (value === null || value === undefined || value === '') continue
      if (Array.isArray(value)) {
        if (value.length === 0) continue
        params.set(short, value.join(','))
      } else if (typeof value === 'boolean') {
        params.set(short, value ? '1' : '0')
      } else {
        params.set(short, String(value))
      }
    }
    params.set('view', view.id)
    router.push(`${basePath}?${params.toString()}`)
  }

  function handleSaveNew() {
    if (!newViewName.trim()) {
      toast.error('View name is required')
      return
    }
    startTransition(async () => {
      const res = await createContactViewAction({
        name: newViewName.trim(),
        filter: currentFilter,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not save smart list')
        return
      }
      toast.success('Smart list saved')
      setDialogOpen(false)
      setNewViewName('')
      // Jump to the freshly-saved view.
      jumpToView(res.data)
    })
  }

  function handleUpdateActive() {
    if (!activeViewId) return
    startTransition(async () => {
      const res = await updateContactViewFilterAction({
        viewId: activeViewId,
        filter: currentFilter,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not update smart list')
        return
      }
      toast.success('Smart list updated')
      router.refresh()
    })
  }

  function handleRenameSubmit() {
    if (!renameTarget) return
    if (!newViewName.trim()) {
      toast.error('View name is required')
      return
    }
    startTransition(async () => {
      const res = await renameContactViewAction({
        viewId: renameTarget.id,
        name: newViewName.trim(),
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not rename smart list')
        return
      }
      toast.success('Renamed')
      setRenameTarget(null)
      setNewViewName('')
      router.refresh()
    })
  }

  function handleDelete(view: ContactViewRow) {
    startTransition(async () => {
      const res = await deleteContactViewAction(view.id)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not delete smart list')
        return
      }
      toast.success('Smart list deleted')
      if (activeViewId === view.id) router.push(basePath)
      else router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b pb-2">
      <TabButton
        active={activeViewId === null}
        onClick={() => jumpToView(null)}
      >
        All
      </TabButton>
      {views.map((view) => {
        const active = view.id === activeViewId
        return (
          <div key={view.id} className="flex items-center">
            <TabButton active={active} onClick={() => jumpToView(view)}>
              {view.name}
            </TabButton>
            {active ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Smart list actions"
                      className="ml-0.5 size-6"
                    />
                  }
                >
                  <MoreHorizontal className="size-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem
                    onClick={() => {
                      setRenameTarget(view)
                      setNewViewName(view.name)
                    }}
                  >
                    <Pencil className="size-3.5" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => handleDelete(view)}
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        )
      })}

      {/* Right-side actions */}
      <div className="ml-auto flex items-center gap-1">
        {activeViewId && isDirty ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUpdateActive}
            disabled={pending}
            className="text-xs"
          >
            Save changes
          </Button>
        ) : null}
        {isDirty || currentQuery ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setNewViewName('')
              setDialogOpen(true)
            }}
            disabled={pending}
            className="gap-1 text-xs"
          >
            <Bookmark className="size-3.5" />
            Save as smart list
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setNewViewName('')
            setDialogOpen(true)
          }}
          disabled={pending}
          className="gap-1 text-xs text-muted-foreground"
        >
          <Plus className="size-3.5" />
          Add smart list
        </Button>
      </div>

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save smart list</DialogTitle>
            <DialogDescription>
              Stores the current filters, sort, and per-page as a named
              tab. Owner-scoped — only you see it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="view-name" className="text-xs">
              Name
            </Label>
            <Input
              id="view-name"
              autoFocus
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              placeholder="e.g. Needs follow-up"
              maxLength={80}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveNew} disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog
        open={!!renameTarget}
        onOpenChange={(o) => !o && setRenameTarget(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename smart list</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="view-rename" className="text-xs">
              Name
            </Label>
            <Input
              id="view-rename"
              autoFocus
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              maxLength={80}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRenameTarget(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={handleRenameSubmit} disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md px-3 py-1.5 text-sm transition-colors',
        active
          ? 'bg-primary/10 font-medium text-primary'
          : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

/** Maps the long filter-blob key names back to the short URL query
 *  keys the /admin/crm/leads page.tsx parser understands. Extend this
 *  when the filter shape grows so a saved view still round-trips. */
const SHORT_KEY: Record<string, string> = {
  statuses: 'statuses',
  sources: 'sources',
  assigneeIds: 'assignees',
  companyName: 'company',
  hasEmail: 'has_email',
  hasPhone: 'has_phone',
  createdFrom: 'created_from',
  createdTo: 'created_to',
  lastActivityFrom: 'activity_from',
  lastActivityTo: 'activity_to',
  search: 'q',
  sortBy: 'sort',
  sortOrder: 'dir',
  perPage: 'per_page',
}

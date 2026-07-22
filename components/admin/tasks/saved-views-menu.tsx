'use client'

// Saved views dropdown next to the filter bar. Reads the current
// URL as the "unsaved" state; picking a view splats its stored
// query back into the URL. Save prompts for a name; delete
// removes.
//
// State-flow: parent shell owns the savedViews array (from the
// workspace payload) and passes it in; this component only owns
// the popover open state + rename/save/delete dispatch. Any
// mutation calls onChanged so the parent refetches.

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import {
  Bookmark,
  BookmarkPlus,
  ChevronDown,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  createSavedViewAction,
  deleteSavedViewAction,
} from '@/app/(admin)/admin/tasks/actions'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { SavedViewRow } from '@/lib/services/task-saved-view-service'

/** Params we DON'T want to save as part of a view:
 *   - task / page / view: interaction state (which drawer is open,
 *     pagination position, list vs board), not filter intent.
 *   - mine: per-user; if operator A saves a view with mine=1,
 *     loading it as operator B would incorrectly filter to A's
 *     tasks. Recomputed live from the checkbox instead. */
const EPHEMERAL_KEYS = new Set(['task', 'page', 'view', 'mine'])

interface SavedViewsMenuProps {
  savedViews: SavedViewRow[]
  onChanged: () => void | Promise<void>
}

export function SavedViewsMenu({
  savedViews,
  onChanged,
}: SavedViewsMenuProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [isBusy, startBusy] = useTransition()

  // Drop ephemeral params before saving/comparing — a view is
  // "filters + sort", not "which task is open".
  const currentQuery = useMemo(() => {
    const next = new URLSearchParams(searchParams.toString())
    for (const key of EPHEMERAL_KEYS) next.delete(key)
    return next.toString()
  }, [searchParams])

  const activeView = savedViews.find((v) => v.query === currentQuery)

  function apply(view: SavedViewRow) {
    setOpen(false)
    // Preserve the view= param (list/board) so switching modes
    // doesn't get clobbered when a saved view is loaded.
    const view_ = searchParams.get('view')
    const next = new URLSearchParams(view.query)
    if (view_) next.set('view', view_)
    router.push(`${pathname}?${next.toString()}`)
  }

  function save() {
    const name = window.prompt('Name for this view:')?.trim()
    if (!name) return
    startBusy(async () => {
      const res = await createSavedViewAction({ name, query: currentQuery })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not save view')
        return
      }
      toast.success(`Saved as "${name}"`)
      await onChanged()
      setOpen(false)
    })
  }

  function remove(id: string, name: string) {
    if (!confirm(`Delete saved view "${name}"?`)) return
    startBusy(async () => {
      const res = await deleteSavedViewAction(id)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not delete view')
        return
      }
      await onChanged()
    })
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        disabled={isBusy}
        render={
          <button
            type="button"
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium shadow-xs transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              activeView &&
                'border-primary/40 bg-primary/5 text-foreground',
            )}
          />
        }
      >
        <Bookmark className="size-3.5" />
        {activeView ? activeView.name : 'Views'}
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 p-1">
        {savedViews.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            No saved views yet. Set some filters, then save this view.
          </p>
        ) : (
          <ul className="max-h-56 space-y-0.5 overflow-y-auto">
            {savedViews.map((view) => {
              const isActive = view.id === activeView?.id
              return (
                <li key={view.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => apply(view)}
                    className={cn(
                      'flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                      'hover:bg-accent',
                      isActive && 'bg-primary/10 font-medium text-primary',
                    )}
                  >
                    {view.name}
                  </button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => remove(view.id, view.name)}
                    disabled={isBusy}
                    aria-label={`Delete view ${view.name}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
        <div className="border-t pt-1">
          <button
            type="button"
            onClick={save}
            disabled={isBusy || currentQuery === ''}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
              'hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <BookmarkPlus className="size-3.5" />
            {currentQuery === ''
              ? 'Set filters first'
              : 'Save current view…'}
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

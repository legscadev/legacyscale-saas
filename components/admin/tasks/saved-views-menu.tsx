'use client'

// Saved views dropdown next to the filter bar. State lives in
// localStorage, keyed by (companyId, userId), so views are private
// to the browser + user + tenant — no server round trip and no
// leakage across super-admin workspace switches.
//
// State-flow: this component owns everything. It hydrates from
// localStorage on mount (client-only to avoid SSR mismatch), writes
// back on every mutation, and mirrors the current URL against the
// stored queries to highlight the active view.
//
// Trade-offs vs the old server-backed impl:
//  - No cross-device sync. A view saved on the desktop won't show
//    up on a phone. Acceptable per the "per user via localStorage"
//    ask; can move back to a synced table if that changes.
//  - No sharing between teammates. Same trade-off; each user owns
//    their own view list.

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import {
  Bookmark,
  BookmarkPlus,
  ChevronDown,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

/** Params we DON'T want to save as part of a view:
 *   - task / page / view: interaction state (which drawer is open,
 *     pagination position, list vs board), not filter intent.
 *   - mine: per-user; if operator A saves a view with mine=1,
 *     loading it as operator B would incorrectly filter to A's
 *     tasks. Recomputed live from the checkbox instead. */
const EPHEMERAL_KEYS = new Set(['task', 'page', 'view', 'mine'])

interface SavedView {
  id: string
  name: string
  query: string
  createdAt: string
}

interface SavedViewsMenuProps {
  /** Active tenant id — part of the localStorage key so views don't
   *  bleed across workspaces when a super-admin switches. */
  companyId: string | null
  /** Current viewer's User.id — part of the storage key so shared
   *  devices keep each user's views separate. */
  currentUserId: string
}

function storageKey(companyId: string | null, userId: string): string {
  return `task-saved-views:${companyId ?? 'no-tenant'}:${userId}`
}

/** Read the stored list. Returns [] on missing / malformed data —
 *  never throws so a corrupted localStorage doesn't take the whole
 *  filter bar down. */
function loadStored(key: string): SavedView[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (v): v is SavedView =>
        typeof v?.id === 'string' &&
        typeof v?.name === 'string' &&
        typeof v?.query === 'string' &&
        typeof v?.createdAt === 'string',
    )
  } catch {
    return []
  }
}

function writeStored(key: string, views: SavedView[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(views))
  } catch {
    // Quota exceeded or private mode — swallow; the UI has already
    // updated its local state, so the user sees their save; it just
    // won't persist across reload.
  }
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function SavedViewsMenu({ companyId, currentUserId }: SavedViewsMenuProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [isBusy, startBusy] = useTransition()
  const [views, setViews] = useState<SavedView[]>([])
  const key = useMemo(
    () => storageKey(companyId, currentUserId),
    [companyId, currentUserId],
  )

  // Hydrate on mount + on key change (super-admin tenant switch).
  useEffect(() => {
    setViews(loadStored(key))
  }, [key])

  // Drop ephemeral params before saving/comparing — a view is
  // "filters + sort", not "which task is open".
  const currentQuery = useMemo(() => {
    const next = new URLSearchParams(searchParams.toString())
    for (const key of EPHEMERAL_KEYS) next.delete(key)
    return next.toString()
  }, [searchParams])

  const activeView = views.find((v) => v.query === currentQuery)

  const persist = useCallback(
    (next: SavedView[]) => {
      setViews(next)
      writeStored(key, next)
    },
    [key],
  )

  function apply(view: SavedView) {
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
    if (views.some((v) => v.name.toLowerCase() === name.toLowerCase())) {
      toast.error(`A view named "${name}" already exists`)
      return
    }
    startBusy(() => {
      const view: SavedView = {
        id: randomId(),
        name,
        query: currentQuery,
        createdAt: new Date().toISOString(),
      }
      persist([view, ...views])
      toast.success(`Saved as "${name}"`)
      setOpen(false)
    })
  }

  function remove(id: string, name: string) {
    if (!confirm(`Delete saved view "${name}"?`)) return
    startBusy(() => {
      persist(views.filter((v) => v.id !== id))
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
        {views.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            No saved views yet. Set some filters, then save this view.
          </p>
        ) : (
          <ul className="max-h-56 space-y-0.5 overflow-y-auto">
            {views.map((view) => {
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

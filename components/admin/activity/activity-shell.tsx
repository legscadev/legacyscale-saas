'use client'

// Cross-domain activity log at /admin/activity. Reads the unified
// feed (AuditLog + per-module logs + LoginEvent) and renders a
// filterable timeline. Client-side filter state — no URL sync,
// same rationale as the /admin/stats picker: sharing a filtered
// audit view isn't a real use case and the params leak internal
// uuids.

import { useMemo, useState, useTransition } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  Check,
  ClipboardList,
  Filter as FilterIcon,
  LogIn,
  MoreVertical,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/shared'
import { cn } from '@/lib/utils'
import {
  type ActivityFeedResult,
  type ActorOption,
  fetchActivityFeedAction,
} from '@/app/(admin)/admin/activity/actions'
import type { EventSource, FeedEvent } from '@/lib/services/audit-log-service'

interface ActivityShellProps {
  initialFeed: ActivityFeedResult
  actors: ActorOption[]
}

const SOURCE_LABEL: Record<EventSource, string> = {
  audit: 'System',
  task: 'Tasks',
  policy: 'Policies',
  org: 'Org',
  announcement: 'Announcements',
  login: 'Auth',
}

const SOURCE_STYLE: Record<EventSource, string> = {
  audit: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
  task: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  policy: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  org: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  announcement: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  login: 'bg-primary/15 text-primary',
}

export function ActivityShell({ initialFeed, actors }: ActivityShellProps) {
  const [items, setItems] = useState<FeedEvent[]>(initialFeed.items)
  const [page, setPage] = useState<number>(initialFeed.page)
  const [hasMore, setHasMore] = useState<boolean>(initialFeed.hasMore)
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState('')
  const [selectedActorIds, setSelectedActorIds] = useState<string[]>([])
  const [selectedSources, setSelectedSources] = useState<EventSource[]>([])
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')

  const applyFilters = () => {
    startTransition(async () => {
      const res = await fetchActivityFeedAction({
        page: 1,
        limit: 50,
        actorIds: selectedActorIds.length > 0 ? selectedActorIds : undefined,
        sources: selectedSources.length > 0 ? selectedSources : undefined,
        fromDate: fromDate || null,
        toDate: toDate || null,
      })
      setItems(res.items)
      setPage(res.page)
      setHasMore(res.hasMore)
    })
  }

  const loadMore = () => {
    startTransition(async () => {
      const res = await fetchActivityFeedAction({
        page: page + 1,
        limit: 50,
        actorIds: selectedActorIds.length > 0 ? selectedActorIds : undefined,
        sources: selectedSources.length > 0 ? selectedSources : undefined,
        fromDate: fromDate || null,
        toDate: toDate || null,
      })
      setItems((prev) => [...prev, ...res.items])
      setPage(res.page)
      setHasMore(res.hasMore)
    })
  }

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((e) => {
      const actorLabel = e.actor?.name ?? e.actor?.email ?? ''
      return (
        e.summary.toLowerCase().includes(q) ||
        actorLabel.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q)
      )
    })
  }, [items, search])

  const anyFilter =
    selectedActorIds.length > 0 ||
    selectedSources.length > 0 ||
    fromDate !== '' ||
    toDate !== ''

  const clearFilters = () => {
    setSelectedActorIds([])
    setSelectedSources([])
    setFromDate('')
    setToDate('')
    startTransition(async () => {
      const res = await fetchActivityFeedAction({ page: 1, limit: 50 })
      setItems(res.items)
      setPage(res.page)
      setHasMore(res.hasMore)
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity log"
        description="A unified feed of edits, additions, deletions, and sign-ins across the app. Admin-only."
      />

      <div className="space-y-3 rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search actor, action, or summary…"
              className="h-9 pl-8 text-sm"
            />
          </div>

          <ActorFilter
            actors={actors}
            selected={selectedActorIds}
            onChange={setSelectedActorIds}
          />

          <SourceFilter
            selected={selectedSources}
            onChange={setSelectedSources}
          />

          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground">From</span>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-9 w-auto"
              aria-label="From date"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-9 w-auto"
              aria-label="To date"
            />
          </div>

          <Button
            onClick={applyFilters}
            disabled={isPending}
            className="h-9"
            variant={anyFilter ? 'default' : 'outline'}
          >
            <FilterIcon className="size-3.5" />
            Apply
          </Button>
          {anyFilter ? (
            <Button
              variant="ghost"
              onClick={clearFilters}
              disabled={isPending}
              className="h-9"
            >
              Clear
            </Button>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          {filteredItems.length} of {items.length} events
          {hasMore ? ' shown — load more below' : ''}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        {filteredItems.length === 0 ? (
          <div className="grid place-items-center gap-2 p-16 text-center">
            <ClipboardList className="size-8 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">No matching activity</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Adjust the filters, or wait — every mutation across the app
              will land here as it happens.
            </p>
          </div>
        ) : (
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="w-40 border-b px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  When
                </th>
                <th className="w-56 border-b px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Actor
                </th>
                <th className="w-32 border-b px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Source
                </th>
                <th className="border-b px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Summary
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((e) => (
                <tr key={e.id} className="group border-b last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                    <span title={e.createdAt.toString()}>
                      {formatDistanceToNow(e.createdAt, { addSuffix: true })}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {e.actor ? (
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium">
                          {e.actor.name ?? e.actor.email}
                        </span>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {e.actor.email}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs italic text-muted-foreground">
                        System
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                        SOURCE_STYLE[e.source],
                      )}
                    >
                      {e.source === 'login' ? (
                        <LogIn className="size-3" aria-hidden />
                      ) : null}
                      {SOURCE_LABEL[e.source]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col">
                      <span className="text-sm">{e.summary}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {e.action}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {hasMore ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={isPending}
          >
            {isPending ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

// ============================================
// Actor multi-select
// ============================================

interface ActorFilterProps {
  actors: ActorOption[]
  selected: string[]
  onChange: (next: string[]) => void
}

function ActorFilter({ actors, selected, onChange }: ActorFilterProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const set = useMemo(() => new Set(selected), [selected])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return actors
    return actors.filter(
      (a) =>
        (a.name?.toLowerCase().includes(q) ?? false) ||
        a.email.toLowerCase().includes(q),
    )
  }, [actors, query])

  const label =
    selected.length === 0
      ? 'All actors'
      : selected.length === 1
        ? actors.find((a) => a.id === selected[0])?.name ??
          actors.find((a) => a.id === selected[0])?.email ??
          '1 actor'
        : `${selected.length} actors`

  const toggle = (id: string) => {
    onChange(set.has(id) ? selected.filter((v) => v !== id) : [...selected, id])
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-medium shadow-xs',
              'hover:bg-accent',
              selected.length > 0 && 'border-primary/40 bg-primary/5',
            )}
          />
        }
      >
        <MoreVertical className="size-3.5 opacity-60" />
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 p-0">
        <div className="border-b p-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search actors…"
            className="h-8 text-sm"
            autoFocus
          />
        </div>
        <ul className="max-h-72 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <li className="px-2 py-4 text-center text-xs text-muted-foreground">
              No actors match.
            </li>
          ) : (
            filtered.map((a) => {
              const checked = set.has(a.id)
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => toggle(a.id)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <div
                      className={cn(
                        'flex size-4 shrink-0 items-center justify-center rounded-sm border',
                        checked
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input',
                      )}
                    >
                      {checked ? <Check className="size-3" /> : null}
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">
                        {a.name ?? a.email}
                      </span>
                      <span className="truncate text-[10px] text-muted-foreground">
                        {a.email}
                      </span>
                    </div>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ============================================
// Source multi-select
// ============================================

interface SourceFilterProps {
  selected: EventSource[]
  onChange: (next: EventSource[]) => void
}

function SourceFilter({ selected, onChange }: SourceFilterProps) {
  const [open, setOpen] = useState(false)
  const set = useMemo(() => new Set(selected), [selected])
  const label =
    selected.length === 0
      ? 'All sources'
      : selected.length === 1
        ? SOURCE_LABEL[selected[0]!]
        : `${selected.length} sources`

  const toggle = (s: EventSource) => {
    onChange(set.has(s) ? selected.filter((v) => v !== s) : [...selected, s])
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-medium shadow-xs',
              'hover:bg-accent',
              selected.length > 0 && 'border-primary/40 bg-primary/5',
            )}
          />
        }
      >
        <MoreVertical className="size-3.5 opacity-60" />
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 p-1">
        {(Object.keys(SOURCE_LABEL) as EventSource[]).map((s) => {
          const checked = set.has(s)
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <div
                className={cn(
                  'flex size-4 shrink-0 items-center justify-center rounded-sm border',
                  checked
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input',
                )}
              >
                {checked ? <Check className="size-3" /> : null}
              </div>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                  SOURCE_STYLE[s],
                )}
              >
                {SOURCE_LABEL[s]}
              </span>
            </button>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

'use client'

// URL-driven filter bar for the Task Tracker (admin + team views).
//
// Every filter maps to a query-string key: q, status, priority,
// category, label, assignee, archived. Multi-select facets encode
// as comma-separated ids so the URL stays a shareable snapshot of
// the view. The parent shell handles fetching — this bar only
// mutates the URL through router.push.
//
// Namespace-aware: the bar is used by both /admin/tasks (ADMIN)
// and /team/tasks (TEAM). It reads the current pathname so filter
// clicks preserve the namespace — hardcoding /admin/tasks would
// bounce TEAM users out of their view and into an ADMIN gate they
// can't pass.

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { Check, Search, SlidersHorizontal, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import type {
  TeamMember,
  WorkflowCategory,
  WorkflowLabel,
  WorkflowStatus,
} from '@/app/(admin)/admin/tasks/actions'
import { TASK_PRIORITY_LABELS } from '@/lib/validations/tasks'

type PriorityValue = keyof typeof TASK_PRIORITY_LABELS

interface TasksFilterBarProps {
  statuses: WorkflowStatus[]
  categories: WorkflowCategory[]
  labels: WorkflowLabel[]
  members: TeamMember[]
}

/** Convert a comma-separated URL param into an array. Empty +
 *  missing both map to []. */
function csvToArray(v: string | null): string[] {
  if (!v) return []
  return v.split(',').filter(Boolean)
}

export function TasksFilterBar({
  statuses,
  categories,
  labels,
  members,
}: TasksFilterBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startNavigation] = useTransition()

  // Local search input state — debounced back to the URL so typing
  // doesn't refetch on every keystroke.
  const urlSearch = searchParams.get('q') ?? ''
  const [searchDraft, setSearchDraft] = useState(urlSearch)

  // Keep the input in sync with browser back/forward navigation.
  useEffect(() => {
    setSearchDraft(urlSearch)
  }, [urlSearch])

  useEffect(() => {
    if (searchDraft === urlSearch) return
    const timer = setTimeout(() => {
      pushParams({ q: searchDraft || null, page: null })
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft])

  const statusIds = csvToArray(searchParams.get('status'))
  const priorityValues = csvToArray(searchParams.get('priority'))
  const categoryIds = csvToArray(searchParams.get('category'))
  const labelIds = csvToArray(searchParams.get('label'))
  const assigneeIds = csvToArray(searchParams.get('assignee'))
  const includeArchived = searchParams.get('archived') === '1'
  const onlyMine = searchParams.get('mine') === '1'

  const hasActive =
    urlSearch !== '' ||
    statusIds.length > 0 ||
    priorityValues.length > 0 ||
    categoryIds.length > 0 ||
    labelIds.length > 0 ||
    assigneeIds.length > 0 ||
    includeArchived ||
    onlyMine

  const paramsCopy = useMemo(
    () => new URLSearchParams(searchParams.toString()),
    [searchParams],
  )

  /** Update multiple query params at once. Null = remove. */
  function pushParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(paramsCopy)
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    startNavigation(() => {
      router.push(`${pathname}?${next.toString()}`)
    })
  }

  function toggleInFacet(
    key: string,
    id: string,
    current: string[],
    checked: boolean,
  ) {
    const next = checked
      ? [...current, id]
      : current.filter((v) => v !== id)
    pushParams({ [key]: next.length > 0 ? next.join(',') : null, page: null })
  }

  function clearAll() {
    setSearchDraft('')
    startNavigation(() => {
      router.push(pathname)
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder="Search title, description…"
          className="pl-8"
        />
      </div>

      <FacetDropdown
        label="Status"
        selectedCount={statusIds.length}
        options={statuses.map((s) => ({ id: s.id, name: s.name }))}
        selected={statusIds}
        onToggle={(id, checked) =>
          toggleInFacet('status', id, statusIds, checked)
        }
        onClear={() => pushParams({ status: null, page: null })}
      />

      <FacetDropdown
        label="Priority"
        selectedCount={priorityValues.length}
        options={(
          Object.entries(TASK_PRIORITY_LABELS) as Array<[PriorityValue, string]>
        ).map(([value, name]) => ({ id: value, name }))}
        selected={priorityValues}
        onToggle={(id, checked) =>
          toggleInFacet('priority', id, priorityValues, checked)
        }
        onClear={() => pushParams({ priority: null, page: null })}
      />

      <FacetDropdown
        label="Category"
        selectedCount={categoryIds.length}
        options={categories}
        selected={categoryIds}
        onToggle={(id, checked) =>
          toggleInFacet('category', id, categoryIds, checked)
        }
        onClear={() => pushParams({ category: null, page: null })}
      />

      <FacetDropdown
        label="Label"
        selectedCount={labelIds.length}
        options={labels}
        selected={labelIds}
        onToggle={(id, checked) =>
          toggleInFacet('label', id, labelIds, checked)
        }
        onClear={() => pushParams({ label: null, page: null })}
      />

      <FacetDropdown
        label="Assignee"
        selectedCount={assigneeIds.length}
        options={members.map((m) => ({
          id: m.id,
          name: m.name ?? m.email.split('@')[0] ?? m.email,
        }))}
        selected={assigneeIds}
        onToggle={(id, checked) =>
          toggleInFacet('assignee', id, assigneeIds, checked)
        }
        onClear={() => pushParams({ assignee: null, page: null })}
      />

      <label
        className={cn(
          'inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium shadow-xs',
          'transition-colors hover:bg-accent hover:text-accent-foreground',
          onlyMine && 'border-primary/40 bg-primary/5 text-foreground',
        )}
      >
        <input
          type="checkbox"
          checked={onlyMine}
          onChange={(e) =>
            pushParams({
              mine: e.target.checked ? '1' : null,
              page: null,
            })
          }
          className="size-3.5 accent-primary"
        />
        Only mine
      </label>

      <label
        className={cn(
          'inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium shadow-xs',
          'transition-colors hover:bg-accent hover:text-accent-foreground',
          includeArchived && 'border-primary/40 bg-primary/5 text-foreground',
        )}
      >
        <input
          type="checkbox"
          checked={includeArchived}
          onChange={(e) =>
            pushParams({
              archived: e.target.checked ? '1' : null,
              page: null,
            })
          }
          className="size-3.5 accent-primary"
        />
        Archived
      </label>

      {hasActive ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="text-muted-foreground"
        >
          <X className="size-3.5" />
          Clear
        </Button>
      ) : null}
    </div>
  )
}

// =========================================================
// Facet dropdown (multi-select checkbox list)
// =========================================================

interface FacetDropdownProps {
  label: string
  selectedCount: number
  options: Array<{ id: string; name: string }>
  selected: string[]
  onToggle: (id: string, checked: boolean) => void
  onClear: () => void
}

function FacetDropdown({
  label,
  selectedCount,
  options,
  selected,
  onToggle,
  onClear,
}: FacetDropdownProps) {
  const selectedSet = useMemo(() => new Set(selected), [selected])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium shadow-xs transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              selectedCount > 0 &&
                'border-primary/40 bg-primary/5 text-foreground',
            )}
          />
        }
      >
        <SlidersHorizontal className="size-3.5" />
        {label}
        {selectedCount > 0 ? (
          <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">
            {selectedCount}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-auto">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>{label}</span>
            {selectedCount > 0 ? (
              <button
                type="button"
                onClick={onClear}
                className="text-xs font-normal text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            ) : null}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {options.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            No options
          </p>
        ) : (
          <div className="p-1">
            {options.map((opt) => {
              const checked = selectedSet.has(opt.id)
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onToggle(opt.id, !checked)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <div
                    className={cn(
                      'flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors',
                      checked
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input',
                    )}
                  >
                    {checked ? <Check className="size-3" /> : null}
                  </div>
                  <span className="min-w-0 flex-1 truncate">{opt.name}</span>
                </button>
              )
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

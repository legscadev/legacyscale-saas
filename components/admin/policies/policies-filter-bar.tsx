'use client'

// URL-driven filter bar for /admin/policies. Filters map to
// ?q, ?category, ?status, ?archived, ?sort, ?dir. Multi-select
// facets encode as comma-separated ids so the URL stays a
// shareable snapshot. The parent shell handles fetching — this
// bar only mutates the URL.
//
// Mirrors the tasks filter bar's shape so the two feel identical
// to operators who bounce between /admin/tasks and /admin/policies.

import { useRouter, useSearchParams } from 'next/navigation'
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

import type { PolicyCategoryRef } from '@/app/(admin)/admin/policies/actions'
import {
  POLICY_STATUS_LABELS,
  type PolicyStatusValue,
} from '@/lib/validations/policy'

interface PoliciesFilterBarProps {
  categories: PolicyCategoryRef[]
}

function csvToArray(v: string | null): string[] {
  if (!v) return []
  return v.split(',').filter(Boolean)
}

export function PoliciesFilterBar({ categories }: PoliciesFilterBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startNavigation] = useTransition()

  const urlSearch = searchParams.get('q') ?? ''
  const [searchDraft, setSearchDraft] = useState(urlSearch)

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

  const statusValues = csvToArray(searchParams.get('status'))
  const categoryIds = csvToArray(searchParams.get('category'))
  const includeArchived = searchParams.get('archived') === '1'

  const hasActive =
    urlSearch !== '' ||
    statusValues.length > 0 ||
    categoryIds.length > 0 ||
    includeArchived

  const paramsCopy = useMemo(
    () => new URLSearchParams(searchParams.toString()),
    [searchParams],
  )

  function pushParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(paramsCopy)
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    startNavigation(() => {
      router.push(`/admin/policies?${next.toString()}`)
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
      router.push('/admin/policies')
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
          placeholder="Search title…"
          className="pl-8"
        />
      </div>

      <FacetDropdown
        label="Status"
        selectedCount={statusValues.length}
        options={(
          Object.entries(POLICY_STATUS_LABELS) as Array<
            [PolicyStatusValue, string]
          >
        ).map(([value, name]) => ({ id: value, name }))}
        selected={statusValues}
        onToggle={(id, checked) =>
          toggleInFacet('status', id, statusValues, checked)
        }
        onClear={() => pushParams({ status: null, page: null })}
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

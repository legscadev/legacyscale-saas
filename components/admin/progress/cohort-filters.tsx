'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowUpDown, Search, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ROLE_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'MEMBER', label: 'Members' },
  { value: 'TEAM', label: 'Team' },
] as const

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'ACTIVE', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'EXPIRED', label: 'Expired' },
] as const

const SORT_OPTIONS = [
  { value: 'progress', label: 'Highest progress' },
  { value: 'enrolled', label: 'Most recently enrolled' },
  { value: 'lastAccess', label: 'Most recently active' },
  { value: 'name', label: 'Name (A-Z)' },
] as const

type RoleValue = (typeof ROLE_OPTIONS)[number]['value']
type StatusValue = (typeof STATUS_OPTIONS)[number]['value']
type SortValue = (typeof SORT_OPTIONS)[number]['value']

export function CohortFilters({
  initialSearch,
  initialRole,
  initialStatus,
  initialSort,
}: {
  initialSearch: string
  initialRole: RoleValue
  initialStatus: StatusValue
  initialSort: SortValue
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(initialSearch)
  const [, startTransition] = useTransition()

  const pushParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') next.delete(key)
        else next.set(key, value)
      }
      // Reset to page 1 whenever a filter changes — current page is
      // probably out of range under the new filter.
      next.delete('page')
      const qs = next.toString()
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname)
      })
    },
    [pathname, router, searchParams],
  )

  useEffect(() => {
    if (search === initialSearch) return
    const handle = setTimeout(() => {
      pushParams({ search: search || null })
    }, 250)
    return () => clearTimeout(handle)
  }, [search, initialSearch, pushParams])

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 pr-8"
        />
        {search ? (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      <PillGroup
        label="Role"
        options={ROLE_OPTIONS}
        active={initialRole}
        onSelect={(value) =>
          pushParams({ role: value === 'ALL' ? null : value })
        }
      />

      <PillGroup
        label="Status"
        options={STATUS_OPTIONS}
        active={initialStatus}
        onSelect={(value) =>
          pushParams({ status: value === 'ALL' ? null : value })
        }
      />

      <Select
        value={initialSort}
        onValueChange={(value) =>
          pushParams({ sort: value === 'progress' ? null : value })
        }
      >
        <SelectTrigger className="h-8 w-auto gap-2 text-xs">
          <ArrowUpDown className="size-3.5 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function PillGroup<T extends string>({
  label,
  options,
  active,
  onSelect,
}: {
  label: string
  options: readonly { value: T; label: string }[]
  active: T
  onSelect: (value: T) => void
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="inline-flex rounded-md border bg-muted/30 p-0.5">
        {options.map((opt) => {
          const isActive = opt.value === active
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSelect(opt.value)}
              className={cn(
                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

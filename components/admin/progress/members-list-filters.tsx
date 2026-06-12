'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowUpDown, Download, Search, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
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

const SORT_OPTIONS = [
  { value: 'recent', label: 'Most recent activity' },
  { value: 'progress', label: 'Highest avg progress' },
  { value: 'enrollments', label: 'Most enrollments' },
  { value: 'name', label: 'Name (A-Z)' },
] as const

type RoleValue = (typeof ROLE_OPTIONS)[number]['value']
type SortValue = (typeof SORT_OPTIONS)[number]['value']

export function MembersListFilters({
  initialSearch,
  initialRole,
  initialSort,
  exportHref,
}: {
  initialSearch: string
  initialRole: RoleValue
  initialSort: SortValue
  exportHref: string
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
      // Reset to page 1 whenever a filter or sort changes.
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
      <div className="relative w-full sm:w-72">
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

      <div className="inline-flex rounded-md border bg-muted/30 p-0.5">
        {ROLE_OPTIONS.map((opt) => {
          const active = opt.value === initialRole
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() =>
                pushParams({ role: opt.value === 'ALL' ? null : opt.value })
              }
              className={cn(
                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                active
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      <Select
        value={initialSort}
        onValueChange={(value) =>
          pushParams({ sort: value === 'recent' ? null : value })
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

      <div className="ml-auto">
        <Button
          variant="outline"
          size="sm"
          render={<a href={exportHref} download />}
        >
          <Download />
          Export CSV
        </Button>
      </div>
    </div>
  )
}

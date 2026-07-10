'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

import type { CompanyKindFilter } from '@/app/(super)/super/companies/types'

const KINDS: Array<{ value: CompanyKindFilter | 'all'; label: string }> = [
  { value: 'all', label: 'All tenants' },
  { value: 'agency', label: 'Agencies' },
  { value: 'sub', label: 'Sub-accounts' },
]

interface CompaniesToolbarProps {
  search: string
  kind: CompanyKindFilter
  onSearchChange: (value: string) => void
  onKindChange: (kind: CompanyKindFilter) => void
  onClearAll: () => void
  isPending: boolean
}

/**
 * Search + filter row for /super/companies. Debounces the search
 * input so a super-admin typing "kondense" doesn't queue five
 * server requests.
 */
export function CompaniesToolbar({
  search,
  kind,
  onSearchChange,
  onKindChange,
  onClearAll,
  isPending,
}: CompaniesToolbarProps) {
  // Local input value so typing is instant; parent updates on debounce.
  const [localSearch, setLocalSearch] = useState(search)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // External resets (clear-all) sync back down.
    setLocalSearch(search)
  }, [search])

  const commitSearch = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onSearchChange(value)
    }, 250)
  }

  const hasActiveFilters = search.length > 0 || kind !== 'all'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-64 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by name or slug…"
          value={localSearch}
          onChange={(e) => {
            setLocalSearch(e.target.value)
            commitSearch(e.target.value)
          }}
          className={cn('pl-9', isPending && 'opacity-70')}
          aria-label="Search companies"
        />
      </div>

      <Select value={kind} onValueChange={(v) => onKindChange(v as CompanyKindFilter)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="All tenants" />
        </SelectTrigger>
        <SelectContent>
          {KINDS.map((k) => (
            <SelectItem key={k.value} value={k.value}>
              {k.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="gap-1.5 text-muted-foreground"
        >
          <X className="size-3.5" />
          Clear
        </Button>
      ) : null}
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { Role } from '@prisma/client'

import type { MemberStatusFilter } from '@/lib/services/member-service'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'

const ROLES = [
  { value: 'all', label: 'Any role' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MEMBER', label: 'Member' },
]

const STATUSES = [
  { value: 'all', label: 'Any status' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'archived', label: 'Archived' },
]

interface MembersToolbarProps {
  search: string
  role: Role | null
  status: MemberStatusFilter | null
  onSearchChange: (value: string) => void
  onRoleChange: (role: Role | null) => void
  onStatusChange: (status: MemberStatusFilter | null) => void
  onClearAll: () => void
  isPending: boolean
}

export function MembersToolbar({
  search,
  role,
  status,
  onSearchChange,
  onRoleChange,
  onStatusChange,
  onClearAll,
  isPending,
}: MembersToolbarProps) {
  // Local search state with debounce so we don't refetch on every keystroke.
  const [draft, setDraft] = useState(search)

  // Re-sync if parent clears search (e.g. Clear all).
  useEffect(() => {
    setDraft(search)
  }, [search])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (draft === search) return
    debounceRef.current = setTimeout(() => {
      onSearchChange(draft.trim())
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  const roleValue = role ?? 'all'
  const statusValue = status ?? 'all'
  const hasActiveFilters =
    search.length > 0 || role !== null || status !== null

  return (
    <div className="sticky top-0 z-10 -mx-px flex flex-col gap-3 border-b bg-background/95 px-px py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search by name or email…"
          className="pl-8"
          data-pending={isPending}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={roleValue}
          onValueChange={(v) =>
            onRoleChange(!v || v === 'all' ? null : (v as Role))
          }
        >
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue>
              {(v: string) =>
                ROLES.find((r) => r.value === v)?.label ?? 'Any role'
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={statusValue}
          onValueChange={(v) =>
            onStatusChange(
              !v || v === 'all' ? null : (v as MemberStatusFilter),
            )
          }
        >
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue>
              {(v: string) =>
                STATUSES.find((s) => s.value === v)?.label ?? 'Any status'
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="text-muted-foreground"
          >
            <X className="size-3.5" />
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}

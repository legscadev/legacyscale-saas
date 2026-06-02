'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'

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
]

export function MembersToolbar() {
  const router = useRouter()
  const params = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const initialQ = params.get('q') ?? ''
  const role = params.get('role') ?? 'all'
  const status = params.get('status') ?? 'all'

  const [q, setQ] = useState(initialQ)

  // Keep local search state in sync if the URL changes from elsewhere
  // (e.g. clicking a tab clears filters).
  useEffect(() => {
    setQ(initialQ)
  }, [initialQ])

  const replaceWith = useCallback(
    (next: URLSearchParams) => {
      // Reset page on any filter change to avoid landing on an empty page.
      next.delete('page')
      const qs = next.toString()
      startTransition(() => {
        router.replace(qs ? `?${qs}` : '?')
      })
    },
    [router],
  )

  // Debounce search submissions so we don't fire on every keystroke.
  useEffect(() => {
    if (q === initialQ) return
    const t = setTimeout(() => {
      const next = new URLSearchParams(params)
      if (q.trim()) next.set('q', q.trim())
      else next.delete('q')
      replaceWith(next)
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (!value || value === 'all') next.delete(key)
    else next.set(key, value)
    replaceWith(next)
  }

  const hasActiveFilters =
    initialQ.length > 0 || role !== 'all' || status !== 'all'

  const clearAll = () => {
    const tab = params.get('tab')
    const next = new URLSearchParams()
    if (tab) next.set('tab', tab)
    replaceWith(next)
  }

  return (
    <div className="sticky top-0 z-10 -mx-px flex flex-col gap-3 border-b bg-background/95 px-px py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or email…"
          className="pl-8"
          data-pending={isPending}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={role} onValueChange={(v) => setParam('role', v)}>
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue>
              {(v: string) => ROLES.find((r) => r.value === v)?.label ?? 'Any role'}
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

        <Select value={status} onValueChange={(v) => setParam('status', v)}>
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
            onClick={clearAll}
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

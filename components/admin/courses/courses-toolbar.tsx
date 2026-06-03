'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { CourseStatus } from '@prisma/client'

import type { CourseView } from '@/lib/services/course-service'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'

const STATUSES = [
  { value: 'all', label: 'Any status' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
]

const VIEWS = [
  { value: 'active', label: 'Active' },
  { value: 'deleted', label: 'Deleted' },
]

interface CoursesToolbarProps {
  search: string
  status: CourseStatus | null
  view: CourseView
  onSearchChange: (value: string) => void
  onStatusChange: (status: CourseStatus | null) => void
  onViewChange: (view: CourseView) => void
  onClearAll: () => void
  isPending: boolean
}

export function CoursesToolbar({
  search,
  status,
  view,
  onSearchChange,
  onStatusChange,
  onViewChange,
  onClearAll,
  isPending,
}: CoursesToolbarProps) {
  const [draft, setDraft] = useState(search)

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

  const statusValue = status ?? 'all'
  const hasActiveFilters =
    search.length > 0 || status !== null || view !== 'active'

  return (
    <div className="sticky top-0 z-10 -mx-px flex flex-col gap-3 bg-background/95 px-px py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search title or description…"
          className="pl-8"
          data-pending={isPending}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={statusValue}
          onValueChange={(v) =>
            onStatusChange(!v || v === 'all' ? null : (v as CourseStatus))
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

        <Select
          value={view}
          onValueChange={(v) => onViewChange((v as CourseView) ?? 'active')}
        >
          <SelectTrigger className="h-9 w-[120px]">
            <SelectValue>
              {(v: string) =>
                VIEWS.find((x) => x.value === v)?.label ?? 'Active'
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {VIEWS.map((x) => (
              <SelectItem key={x.value} value={x.value}>
                {x.label}
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

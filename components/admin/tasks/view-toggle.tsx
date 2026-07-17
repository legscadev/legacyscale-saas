'use client'

// List/Board toggle that mirrors the current view to ?view=<mode>.
// Keeps every other search param intact so filters carry across
// modes — the operator can filter down to their team's work in
// list view and switch to board without losing context.

import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useTransition } from 'react'
import { KanbanSquare, List } from 'lucide-react'

import { cn } from '@/lib/utils'

export type TasksViewMode = 'list' | 'board'

interface ViewToggleProps {
  value: TasksViewMode
}

const OPTIONS: Array<{
  value: TasksViewMode
  label: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { value: 'board', label: 'Board', icon: KanbanSquare },
  { value: 'list', label: 'List', icon: List },
]

export function ViewToggle({ value }: ViewToggleProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startNavigation] = useTransition()

  const paramsCopy = useMemo(
    () => new URLSearchParams(searchParams.toString()),
    [searchParams],
  )

  function switchTo(mode: TasksViewMode) {
    if (mode === value) return
    const next = new URLSearchParams(paramsCopy)
    if (mode === 'board') {
      // Default view; drop the param for a cleaner URL. Also clear
      // list-only sort keys — the board sorts by orderIndex.
      next.delete('view')
      next.delete('sort')
      next.delete('dir')
    } else {
      next.set('view', mode)
    }
    startNavigation(() => {
      router.push(`/admin/tasks?${next.toString()}`)
    })
  }

  return (
    <div
      role="tablist"
      aria-label="Task view"
      className="inline-flex h-9 items-center gap-0.5 rounded-md border bg-background p-0.5 shadow-xs"
    >
      {OPTIONS.map((opt) => {
        const Icon = opt.icon
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => switchTo(opt.value)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-sm font-medium transition-colors',
              active
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="size-3.5" />
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

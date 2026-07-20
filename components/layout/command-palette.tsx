'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Search } from 'lucide-react'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  adminNav,
  filterNavForRole,
  memberNav,
  superNav,
  type NavItem,
  type NavRole,
} from '@/lib/config/navigation'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: 'admin' | 'member' | 'super'
  /** User role for visibleTo filtering — a TEAM viewer in the
   *  member shell needs the same nav filtering the sidebar applies. */
  userRole: NavRole
}

interface FlatItem extends NavItem {
  section?: string
}

function flatten(
  role: 'admin' | 'member' | 'super',
  userRole: NavRole,
): FlatItem[] {
  const rawSections =
    role === 'super' ? superNav : role === 'admin' ? adminNav : memberNav
  const sections = filterNavForRole(rawSections, userRole)
  return sections.flatMap((s) =>
    s.items.map((item) => ({ ...item, section: s.label })),
  )
}

export function CommandPalette({
  open,
  onOpenChange,
  role,
  userRole,
}: CommandPaletteProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const items = useMemo(() => flatten(role, userRole), [role, userRole])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => {
      const haystack = `${item.label} ${item.href} ${item.section ?? ''}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [items, query])

  // Reset on open / query change
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      // Autofocus runs after the dialog mounts — small delay so the
      // animation completes first.
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const go = (item: FlatItem) => {
    onOpenChange(false)
    router.push(item.href)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = filtered[activeIndex]
      if (item) go(item)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[20vh] max-w-xl translate-y-0 gap-0 overflow-hidden p-0"
      >
        <div className="flex items-center gap-3 border-b px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages…"
            aria-label="Search"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden h-5 items-center rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground sm:flex">
            ESC
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No results for &quot;{query}&quot;
            </div>
          ) : (
            <ul role="listbox" aria-label="Search results">
              {filtered.map((item, i) => {
                const Icon = item.icon
                const active = i === activeIndex
                return (
                  <li key={item.href}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => go(item)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                        active
                          ? 'bg-muted text-foreground'
                          : 'text-muted-foreground hover:bg-muted/60',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-7 items-center justify-center rounded-md',
                          active
                            ? 'bg-background text-foreground ring-1 ring-foreground/10'
                            : 'bg-muted/60 text-muted-foreground',
                        )}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <span className="flex flex-col leading-tight">
                        <span
                          className={cn(
                            'font-medium',
                            active ? 'text-foreground' : 'text-foreground/90',
                          )}
                        >
                          {item.label}
                        </span>
                        {item.section ? (
                          <span className="text-[11px] text-muted-foreground">
                            {item.section}
                          </span>
                        ) : null}
                      </span>
                      {active ? (
                        <ArrowRight className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-card px-1.5">↑</kbd>
              <kbd className="rounded border bg-card px-1.5">↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-card px-1.5">↵</kbd>
              open
            </span>
          </div>
          <span>{filtered.length} result{filtered.length === 1 ? '' : 's'}</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

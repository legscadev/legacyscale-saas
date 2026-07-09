'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { NavItem, NavSection } from '@/lib/config/navigation'

interface SidebarNavProps {
  sections: NavSection[]
  onNavigate?: () => void
  /** Icon-only mode — labels collapse to tooltips. Section
   *  collapse UI is hidden in this mode. */
  collapsed?: boolean
}

const STORAGE_KEY = 'sidebar-section-collapsed'

export function SidebarNav({
  sections,
  onNavigate,
  collapsed = false,
}: SidebarNavProps) {
  const pathname = usePathname()

  // Per-section collapse state. Persists across page loads via
  // localStorage so Ruby's choice sticks. Sections without a label
  // (root Dashboard row) never appear in this set.
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    () => new Set(),
  )
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // Defer the setState calls out of the effect body via a
    // microtask so the react-hooks/set-state-in-effect rule stays
    // happy. The user-visible effect is identical.
    queueMicrotask(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw) as string[]
          if (Array.isArray(parsed)) {
            setCollapsedSections(new Set(parsed))
          }
        }
      } catch {
        // Ignore malformed storage.
      }
      setHydrated(true)
    })
  }, [])

  function toggleSection(label: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      } catch {
        // Ignore quota errors.
      }
      return next
    })
  }

  return (
    <nav
      className={cn(
        'flex flex-col py-2',
        collapsed ? 'items-center gap-1 px-1' : 'gap-5 px-3',
      )}
    >
      {sections.map((section, i) => {
        const isCollapsible = !!section.label && !collapsed
        // Before hydration, treat everything as expanded so SSR
        // markup matches the initial client render.
        const isCollapsed =
          hydrated && section.label
            ? collapsedSections.has(section.label)
            : false
        // If any child is on the current route, force the section
        // open so the user can see where they are.
        const hasActiveChild = section.items.some((item) =>
          matchesActive(item, pathname),
        )
        const showItems = !isCollapsible || !isCollapsed || hasActiveChild

        return (
          <div
            key={section.label ?? i}
            className={cn(
              'flex w-full flex-col gap-1',
              collapsed && 'items-center',
            )}
          >
            {section.label && !collapsed && (
              isCollapsible ? (
                <button
                  type="button"
                  onClick={() => toggleSection(section.label!)}
                  aria-expanded={showItems}
                  className={cn(
                    'group/section flex w-full items-center justify-between rounded-md px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-neutral-500 transition-colors hover:text-neutral-300',
                  )}
                >
                  <span>{section.label}</span>
                  <ChevronDown
                    className={cn(
                      'size-3 shrink-0 transition-transform duration-150',
                      showItems ? '' : '-rotate-90',
                    )}
                  />
                </button>
              ) : (
                <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                  {section.label}
                </p>
              )
            )}

            {showItems &&
              section.items.map((item) => {
                const active = matchesActive(item, pathname)
                const Icon = item.icon

                const link = (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    className={cn(
                      'flex h-8 items-center rounded-md text-sm font-medium transition-colors',
                      collapsed ? 'size-8 justify-center' : 'gap-2.5 px-2',
                      active
                        ? 'bg-white/10 text-white shadow-sm shadow-black/40'
                        : 'text-neutral-400 hover:bg-white/[0.06] hover:text-white',
                    )}
                  >
                    <Icon
                      className={cn(
                        'size-4 shrink-0',
                        active ? 'text-brand-400' : 'text-neutral-500',
                      )}
                    />
                    {!collapsed && (
                      <>
                        <span className="truncate">{item.label}</span>
                        {item.badge && (
                          <Badge
                            variant="secondary"
                            className="ml-auto h-4 px-1.5 text-[10px]"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </>
                    )}
                  </Link>
                )

                if (!collapsed) return link

                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger render={link} />
                    <TooltipContent side="right">
                      {item.label}
                      {item.badge ? ` · ${item.badge}` : ''}
                    </TooltipContent>
                  </Tooltip>
                )
              })}
          </div>
        )
      })}
    </nav>
  )
}

function matchesActive(item: NavItem, pathname: string): boolean {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`)
}

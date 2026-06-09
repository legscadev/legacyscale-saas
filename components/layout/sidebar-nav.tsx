'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { NavSection } from '@/lib/config/navigation'

interface SidebarNavProps {
  sections: NavSection[]
  onNavigate?: () => void
  /** Icon-only mode — labels collapse to tooltips. */
  collapsed?: boolean
}

export function SidebarNav({
  sections,
  onNavigate,
  collapsed = false,
}: SidebarNavProps) {
  const pathname = usePathname()

  return (
    <nav
      className={cn(
        'flex flex-col py-2',
        collapsed ? 'items-center gap-1 px-1' : 'gap-5 px-3',
      )}
    >
      {sections.map((section, i) => (
        <div key={section.label ?? i} className="flex w-full flex-col gap-1">
          {section.label && !collapsed && (
            <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
              {section.label}
            </p>
          )}
          {section.items.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`)
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
                  collapsed
                    ? 'size-8 justify-center'
                    : 'gap-2.5 px-2',
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
      ))}
    </nav>
  )
}

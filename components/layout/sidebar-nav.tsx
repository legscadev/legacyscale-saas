'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { NavSection } from '@/lib/config/navigation'

interface SidebarNavProps {
  sections: NavSection[]
  onNavigate?: () => void
}

export function SidebarNav({ sections, onNavigate }: SidebarNavProps) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-5 px-3 py-2">
      {sections.map((section, i) => (
        <div key={section.label ?? i} className="flex flex-col gap-1">
          {section.label && (
            <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              {section.label}
            </p>
          )}
          {section.items.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-8 items-center gap-2.5 rounded-md px-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )}
              >
                <Icon
                  className={cn(
                    'size-4 shrink-0',
                    active ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
                <span className="truncate">{item.label}</span>
                {item.badge && (
                  <Badge
                    variant="secondary"
                    className="ml-auto h-4 px-1.5 text-[10px]"
                  >
                    {item.badge}
                  </Badge>
                )}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

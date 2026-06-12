'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

interface ProgressTab {
  label: string
  href: string
  /** When true, only highlight when pathname matches exactly. The
   *  Overview tab uses this so it doesn't stay active on child routes. */
  exact?: boolean
}

const TABS: ProgressTab[] = [
  { label: 'Overview', href: '/admin/progress', exact: true },
  { label: 'Members', href: '/admin/progress/members' },
  { label: 'Courses', href: '/admin/progress/courses' },
]

export function ProgressTabs() {
  const pathname = usePathname()

  return (
    <div className="border-b">
      <nav className="-mb-px flex gap-1" aria-label="Progress Tracker sections">
        {TABS.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex items-center border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

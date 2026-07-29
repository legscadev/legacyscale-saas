'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

interface OpportunitiesTabsProps {
  /** URL base for the tab set — '/admin/crm/opportunities' or
   *  '/team/crm/opportunities'. Every tab href is derived from it. */
  basePath: string
}

/**
 * Sub-navigation for the Opportunities section (mirrors HighLevel):
 * Board / Pipelines / Bulk Actions. Kept as its own component so
 * every sub-page can drop it in the same slot with no local state.
 */
export function OpportunitiesTabs({ basePath }: OpportunitiesTabsProps) {
  const pathname = usePathname()

  const tabs = [
    { label: 'Opportunities', href: basePath },
    { label: 'Pipelines', href: `${basePath}/pipelines` },
    { label: 'Bulk Actions', href: `${basePath}/bulk-actions` },
  ]

  return (
    <nav
      aria-label="Opportunities sections"
      className="flex items-center gap-1 border-b text-sm"
    >
      {tabs.map((tab) => {
        // Exact match for the board (basePath) so it doesn't also light
        // up under /pipelines or /bulk-actions.
        const isActive =
          tab.href === basePath
            ? pathname === basePath
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`)

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 font-medium transition-colors',
              isActive
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:border-muted hover:text-foreground',
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

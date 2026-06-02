'use client'

import { cn } from '@/lib/utils'
import type {
  MemberCounts,
  MemberTab,
} from '@/lib/services/member-service'

interface MembersTabsProps {
  active: MemberTab
  counts: MemberCounts
  onChange: (tab: MemberTab) => void
}

const TABS: { id: MemberTab; label: string }[] = [
  { id: 'all', label: 'All members' },
  { id: 'admins', label: 'Admins' },
  { id: 'members', label: 'Members' },
  { id: 'suspended', label: 'Suspended' },
  { id: 'archived', label: 'Archived' },
]

function countFor(id: MemberTab, counts: MemberCounts): number {
  switch (id) {
    case 'all':
      return counts.all
    case 'admins':
      return counts.admins
    case 'members':
      return counts.members
    case 'suspended':
      return counts.suspended
    case 'archived':
      return counts.archived
  }
}

export function MembersTabs({ active, counts, onChange }: MembersTabsProps) {
  return (
    <div className="overflow-x-auto border-b">
      <nav
        className="-mb-px flex min-w-max items-center gap-1"
        aria-label="Member tabs"
        role="tablist"
      >
        {TABS.map((t) => {
          const isActive = t.id === active
          const n = countFor(t.id, counts)
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(t.id)}
              className={cn(
                'group inline-flex items-center gap-2 border-b-2 px-3 pb-3 pt-2 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
              <span
                className={cn(
                  'inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-xs tabular-nums transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground group-hover:bg-muted-foreground/10',
                )}
              >
                {n.toLocaleString()}
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

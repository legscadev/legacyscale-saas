'use client'

import { cn } from '@/lib/utils'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
    <Tabs
      value={active}
      onValueChange={(v) => onChange(v as MemberTab)}
      className="border-b"
    >
      <TabsList variant="line" className="h-auto w-full justify-start overflow-x-auto">
        {TABS.map((t) => {
          const n = countFor(t.id, counts)
          const isActive = t.id === active
          return (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className="h-9 flex-none gap-2 px-3 data-active:after:bg-primary data-active:text-foreground"
            >
              {t.label}
              <span
                className={cn(
                  'inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-xs tabular-nums transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {n.toLocaleString()}
              </span>
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
  )
}

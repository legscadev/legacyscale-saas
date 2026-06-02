import {
  ArrowDown,
  ArrowUp,
  Minus,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import type { MemberCounts } from '@/lib/services/member-service'

interface MembersMetricsProps {
  counts: MemberCounts
}

interface Card {
  label: string
  value: number
  helper: string
  icon: React.ComponentType<{ className?: string }>
  trend?: 'up' | 'down' | 'flat'
}

export function MembersMetrics({ counts }: MembersMetricsProps) {
  const cards: Card[] = [
    {
      label: 'Total members',
      value: counts.all,
      helper: 'Across all roles',
      icon: Users,
      trend: 'flat',
    },
    {
      label: 'Active',
      value: counts.active,
      helper: 'Signed in & enabled',
      icon: UserCheck,
      trend: 'up',
    },
    {
      label: 'Admins',
      value: counts.admins,
      helper: 'Full platform access',
      icon: ShieldCheck,
      trend: 'flat',
    },
    {
      label: 'Suspended',
      value: counts.suspended,
      helper: 'Access paused',
      icon: UserX,
      trend: counts.suspended > 0 ? 'down' : 'flat',
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <MetricCard key={c.label} {...c} />
      ))}
    </div>
  )
}

function MetricCard({ label, value, helper, icon: Icon, trend }: Card) {
  const TrendIcon =
    trend === 'up' ? ArrowUp : trend === 'down' ? ArrowDown : Minus
  const trendClass =
    trend === 'up'
      ? 'text-success'
      : trend === 'down'
        ? 'text-error'
        : 'text-muted-foreground'

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-2xl font-semibold tabular-nums tracking-tight">
          {value.toLocaleString()}
        </p>
        <TrendIcon className={cn('size-3.5', trendClass)} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
    </div>
  )
}

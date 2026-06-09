import { Archive, FileEdit, GraduationCap, Send } from 'lucide-react'

import { Card } from '@/components/ui/card'
import type { CourseCounts } from '@/lib/services/course-service'

interface CoursesMetricsProps {
  counts: CourseCounts
}

interface MetricCardData {
  label: string
  value: number
  helper: string
  icon: React.ComponentType<{ className?: string }>
}

export function CoursesMetrics({ counts }: CoursesMetricsProps) {
  const cards: MetricCardData[] = [
    {
      label: 'Total courses',
      value: counts.all,
      helper: 'Across all statuses',
      icon: GraduationCap,
    },
    {
      label: 'Published',
      value: counts.published,
      helper: 'Live for members',
      icon: Send,
    },
    {
      label: 'Drafts',
      value: counts.draft,
      helper: 'Not yet released',
      icon: FileEdit,
    },
    {
      label: 'Archived',
      value: counts.archived,
      helper: 'Hidden from members',
      icon: Archive,
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

function MetricCard({ label, value, helper, icon: Icon }: MetricCardData) {
  return (
    <Card size="sm" className="gap-2 px-4">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="text-2xl font-semibold tabular-nums tracking-tight">
        {value.toLocaleString()}
      </p>
      <p className="-mt-1 text-xs text-muted-foreground">{helper}</p>
    </Card>
  )
}

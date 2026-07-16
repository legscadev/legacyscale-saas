// Top-of-page numbers strip for /admin/tasks. Wraps the shared
// StatStrip primitive so the tracker's specific tone rules
// (overdue = destructive, dueSoon = warning) live in one place.

import { AlertTriangle, Archive, CheckCircle2, ListTodo } from 'lucide-react'

import { StatStrip } from '@/components/shared/stat-strip'

import type { TaskStats } from '@/app/(admin)/admin/tasks/actions'

interface TasksStatStripProps {
  stats: TaskStats
}

export function TasksStatStrip({ stats }: TasksStatStripProps) {
  return (
    <StatStrip
      cells={[
        {
          label: 'Open',
          value: stats.openTotal,
          icon: ListTodo,
          description: `${stats.total} total`,
        },
        {
          label: 'Overdue',
          value: stats.overdue,
          icon: AlertTriangle,
          valueClassName: stats.overdue > 0 ? 'text-rose-600' : undefined,
          description: 'Past due, still open',
        },
        {
          label: 'Due soon',
          value: stats.dueSoon,
          icon: CheckCircle2,
          valueClassName: stats.dueSoon > 0 ? 'text-amber-600' : undefined,
          description: 'Due within 3 days',
        },
        {
          label: 'Archived',
          value: stats.archived,
          icon: Archive,
          description: 'Hidden from default view',
        },
      ]}
    />
  )
}

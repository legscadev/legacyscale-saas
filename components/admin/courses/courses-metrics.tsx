import { Archive, FileEdit, GraduationCap, Send } from 'lucide-react'

import { StatStrip, type StatStripCell } from '@/components/shared'
import type { CourseCounts } from '@/lib/services/course-service'

interface CoursesMetricsProps {
  counts: CourseCounts
}

export function CoursesMetrics({ counts }: CoursesMetricsProps) {
  const cells: StatStripCell[] = [
    {
      label: 'Total courses',
      value: counts.all.toLocaleString(),
      description: 'Across all statuses',
      icon: GraduationCap,
    },
    {
      label: 'Published',
      value: counts.published.toLocaleString(),
      description: 'Live for members',
      icon: Send,
    },
    {
      label: 'Drafts',
      value: counts.draft.toLocaleString(),
      description: 'Not yet released',
      icon: FileEdit,
    },
    {
      label: 'Archived',
      value: counts.archived.toLocaleString(),
      description: 'Hidden from members',
      icon: Archive,
    },
  ]
  return <StatStrip cells={cells} />
}

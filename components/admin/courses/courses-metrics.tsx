import { Archive, FileEdit, GraduationCap, Send } from 'lucide-react'

import { StatStrip, type StatStripCell } from '@/components/shared'
import type { CourseCounts } from '@/lib/services/course-service'

interface CoursesMetricsProps {
  counts: CourseCounts
  /** Noun used in the labels ("courses" vs "trainings"). Falls back
   *  to "course/courses" so /admin/courses is unchanged. */
  noun?: { singular: string; plural: string }
  /** Which surface the strip is being rendered on. Drives the
   *  description copy so "Published" reads correctly:
   *    - members  → "Live for members"
   *    - internal → "Live for the internal team"
   *    - mixed    → "Live"
   *  Falls back to the previous mixed copy. */
  lens?: 'members' | 'internal' | 'mixed'
}

export function CoursesMetrics({
  counts,
  noun,
  lens = 'members',
}: CoursesMetricsProps) {
  const plural = noun?.plural ?? 'courses'
  const totalLabel = `Total ${plural}`
  const publishedDesc =
    lens === 'internal'
      ? 'Live for the internal team'
      : lens === 'members'
        ? 'Live for members'
        : 'Live'
  const archivedDesc =
    lens === 'internal'
      ? 'Hidden from the internal team'
      : lens === 'members'
        ? 'Hidden from members'
        : 'Hidden'

  const cells: StatStripCell[] = [
    {
      label: totalLabel.charAt(0).toUpperCase() + totalLabel.slice(1),
      value: counts.all.toLocaleString(),
      description: 'Across all statuses',
      icon: GraduationCap,
    },
    {
      label: 'Published',
      value: counts.published.toLocaleString(),
      description: publishedDesc,
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
      description: archivedDesc,
      icon: Archive,
    },
  ]
  return <StatStrip cells={cells} />
}

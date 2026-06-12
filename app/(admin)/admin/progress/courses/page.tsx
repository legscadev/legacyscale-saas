import { GraduationCap } from 'lucide-react'

import { EmptyState } from '@/components/shared'

export default function AdminProgressCoursesPage() {
  // Placeholder — courses table with enrollment + completion KPIs, plus
  // a per-course cohort view (with CSV export) land in Step 4.
  return (
    <EmptyState
      icon={GraduationCap}
      title="Course progress coming soon"
      description="Per-course enrollment, average progress, completion rate, and a full cohort view with CSV export."
    />
  )
}

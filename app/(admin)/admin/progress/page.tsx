import { TrendingUp } from 'lucide-react'

import { EmptyState } from '@/components/shared'

export default function AdminProgressOverviewPage() {
  // Placeholder — KPIs, most-engaged members, top courses, and recent
  // completions land in Step 2.
  return (
    <EmptyState
      icon={TrendingUp}
      title="Overview coming soon"
      description="KPIs, most-engaged members, top courses, and recent completions will appear here."
    />
  )
}

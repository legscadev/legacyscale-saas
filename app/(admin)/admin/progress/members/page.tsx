import { Users } from 'lucide-react'

import { EmptyState } from '@/components/shared'

export default function AdminProgressMembersPage() {
  // Placeholder — table of members with enrollment + progress aggregates,
  // search/filter, and drilldown links land in Step 3.
  return (
    <EmptyState
      icon={Users}
      title="Members progress coming soon"
      description="A table of every member with at least one enrollment, plus per-member drilldown into their course progress."
    />
  )
}

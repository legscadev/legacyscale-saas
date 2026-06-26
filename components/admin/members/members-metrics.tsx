import { ShieldCheck, UserCheck, UserX, Users } from 'lucide-react'

import { StatStrip, type StatStripCell } from '@/components/shared'
import type { MemberCounts } from '@/lib/services/member-service'

interface MembersMetricsProps {
  counts: MemberCounts
}

export function MembersMetrics({ counts }: MembersMetricsProps) {
  const cells: StatStripCell[] = [
    {
      label: 'Total members',
      value: counts.all.toLocaleString(),
      description: 'Across all roles',
      icon: Users,
    },
    {
      label: 'Active',
      value: counts.active.toLocaleString(),
      description: 'Signed in & enabled',
      icon: UserCheck,
    },
    {
      label: 'Admins',
      value: counts.admins.toLocaleString(),
      description: 'Full platform access',
      icon: ShieldCheck,
    },
    {
      label: 'Suspended',
      value: counts.suspended.toLocaleString(),
      description: 'Access paused',
      icon: UserX,
    },
  ]
  return <StatStrip cells={cells} />
}

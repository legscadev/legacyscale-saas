import {
  Archive,
  ShieldCheck,
  UserCheck,
  UserCog,
  UserX,
  Users,
} from 'lucide-react'

import { StatStrip, type StatStripCell } from '@/components/shared'
import type { MemberCounts } from '@/lib/services/member-service'

export type MembersLens = 'members' | 'team' | 'mixed'

interface MembersMetricsProps {
  counts: MemberCounts
  /** Which population the parent page is showing. Drives the card
   *  labels + which counts get surfaced so the strip matches the
   *  table below it. */
  lens?: MembersLens
}

export function MembersMetrics({ counts, lens = 'mixed' }: MembersMetricsProps) {
  const cells: StatStripCell[] = buildCells(counts, lens)
  return <StatStrip cells={cells} />
}

function buildCells(counts: MemberCounts, lens: MembersLens): StatStripCell[] {
  if (lens === 'team') {
    return [
      {
        label: 'Total team',
        value: counts.all.toLocaleString(),
        description: 'Admins + internal staff',
        icon: Users,
      },
      {
        label: 'Admins',
        value: counts.admins.toLocaleString(),
        description: 'Full platform access',
        icon: ShieldCheck,
      },
      {
        label: 'Team members',
        value: counts.team.toLocaleString(),
        description: 'Internal staff role',
        icon: UserCog,
      },
      {
        label: 'Suspended',
        value: counts.suspended.toLocaleString(),
        description: 'Access paused',
        icon: UserX,
      },
    ]
  }
  if (lens === 'members') {
    return [
      {
        label: 'Total members',
        value: counts.all.toLocaleString(),
        description: 'Students on the platform',
        icon: Users,
      },
      {
        label: 'Active',
        value: counts.active.toLocaleString(),
        description: 'Signed in & enabled',
        icon: UserCheck,
      },
      {
        label: 'Suspended',
        value: counts.suspended.toLocaleString(),
        description: 'Access paused',
        icon: UserX,
      },
      {
        label: 'Archived',
        value: counts.archived.toLocaleString(),
        description: 'Removed from the roster',
        icon: Archive,
      },
    ]
  }
  // Default (mixed) — legacy behaviour.
  return [
    {
      label: 'Total users',
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
}

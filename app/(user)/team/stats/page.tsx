import { redirect } from 'next/navigation'

import { requireTeamModuleAccess } from '@/lib/auth/get-user'
import { StatsShell } from '@/components/admin/stats/stats-shell'
import {
  fetchAllMetrics,
  fetchDivisions,
  listAssigneesForStats,
} from '@/app/(admin)/admin/stats/actions'

// TEAM-side wrapper for Statistics. ADMIN gets bounced to
// /admin/stats. Same shell/actions as the admin surface.

export const dynamic = 'force-dynamic'

interface TeamStatsPageProps {
  searchParams: Promise<{ division?: string }>
}

export default async function TeamStatsPage({
  searchParams,
}: TeamStatsPageProps) {
  const viewer = await requireTeamModuleAccess('stats')
  if (viewer.role === 'ADMIN') redirect('/admin/stats')

  const params = await searchParams
  const [divisions, metrics, assignees] = await Promise.all([
    fetchDivisions(),
    fetchAllMetrics(),
    listAssigneesForStats(),
  ])

  return (
    <StatsShell
      currentUserId={viewer.id}
      currentUserIsAdmin={false}
      divisions={divisions}
      initialDivisionId={params.division ?? null}
      metrics={metrics}
      assignees={assignees}
    />
  )
}

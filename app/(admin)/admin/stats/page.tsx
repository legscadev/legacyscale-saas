import { requireAdmin } from '@/lib/auth/get-user'
import { StatsShell } from '@/components/admin/stats/stats-shell'
import {
  fetchAllMetrics,
  fetchDivisions,
  listAssigneesForStats,
} from './actions'

export const dynamic = 'force-dynamic'

interface StatsPageProps {
  searchParams: Promise<{ division?: string }>
}

export default async function AdminStatsPage({ searchParams }: StatsPageProps) {
  const admin = await requireAdmin()
  const params = await searchParams

  // Fetch every division + every metric in one round-trip. The
  // client shell filters + groups on demand — much cheaper than
  // per-division fetches now that the left rail can show any group
  // and search spans everything.
  const [divisions, metrics, assignees] = await Promise.all([
    fetchDivisions(),
    fetchAllMetrics(),
    listAssigneesForStats(),
  ])

  return (
    <StatsShell
      currentUserId={admin.id}
      currentUserIsAdmin={true}
      divisions={divisions}
      initialDivisionId={params.division ?? null}
      metrics={metrics}
      assignees={assignees}
    />
  )
}

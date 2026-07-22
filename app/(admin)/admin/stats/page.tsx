import { requireAdmin } from '@/lib/auth/get-user'
import { StatsShell } from '@/components/admin/stats/stats-shell'
import {
  fetchAllMetrics,
  fetchDivisions,
  listAssigneesForStats,
} from './actions'

export const dynamic = 'force-dynamic'

interface StatsPageProps {
  searchParams: Promise<{ division?: string; assignee?: string }>
}

/** Parse ?assignee=<csv> into a clean id array. Empty / missing =
 *  no filter selected. Duplicates + blanks are stripped. */
function parseAssigneeIds(raw: string | undefined): string[] {
  if (!raw) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const chunk of raw.split(',')) {
    const trimmed = chunk.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out
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
      initialAssigneeIds={parseAssigneeIds(params.assignee)}
      metrics={metrics}
      assignees={assignees}
    />
  )
}

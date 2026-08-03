import {  requireTeamModuleAccess  } from "@/lib/auth/get-user"
import { StatsShell } from '@/components/admin/stats/stats-shell'
import {
  getBridgeDivisionSummary,
  listBridgeCards,
} from '@/lib/services/production-bridge-service'
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
  const admin = await requireTeamModuleAccess("stats")
  const params = await searchParams

  // Fetch every division + every metric in one round-trip. The
  // client shell filters + groups on demand — much cheaper than
  // per-division fetches now that the left rail can show any group
  // and search spans everything.
  //
  // Bridge cards + the synthetic "Sales — Production Sheets"
  // division are fetched alongside so the client shell can show them
  // in the same divisions rail / metrics grid as regular metrics
  // without a second round-trip.
  const [divisions, metrics, assignees, bridgeDivision, bridgeCards] =
    await Promise.all([
      fetchDivisions(),
      fetchAllMetrics(),
      listAssigneesForStats(),
      getBridgeDivisionSummary(),
      listBridgeCards(),
    ])

  // Only append the bridge division if there's at least one author
  // to render cards for — an empty rail entry would confuse.
  //
  // Card count in the rail badge is derived from the actual cards
  // list, not authors × KPI count, because we now skip KPIs a user
  // has never entered (a setter who only fills Phone Calls only
  // gets one card, not 12).
  const allDivisions =
    bridgeCards.length > 0
      ? [...divisions, { ...bridgeDivision, metricCount: bridgeCards.length }]
      : divisions
  const allMetrics =
    bridgeCards.length > 0 ? [...metrics, ...bridgeCards] : metrics

  return (
    <StatsShell
      currentUserId={admin.id}
      currentUserIsAdmin={true}
      divisions={allDivisions}
      initialDivisionId={params.division ?? null}
      initialAssigneeIds={parseAssigneeIds(params.assignee)}
      metrics={allMetrics}
      assignees={assignees}
    />
  )
}

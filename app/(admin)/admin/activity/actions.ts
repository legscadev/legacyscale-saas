'use server'

import { requireAdmin } from '@/lib/auth/get-user'
import {
  listActors,
  listFeed,
  type EventSource,
  type FeedEvent,
} from '@/lib/services/audit-log-service'

export interface ActivityFeedResult {
  items: FeedEvent[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export interface FetchFeedInput {
  page?: number
  limit?: number
  actorIds?: string[]
  sources?: EventSource[]
  /** ISO date strings (YYYY-MM-DD). Empty = no bound. */
  fromDate?: string | null
  toDate?: string | null
}

/**
 * Sole entry point for the /admin/activity feed. ADMIN-only —
 * the UI is opaque to TEAM users because the sidebar nav gates
 * the link too, but we still self-gate here in case a stale
 * link is opened.
 */
export async function fetchActivityFeedAction(
  input: FetchFeedInput = {},
): Promise<ActivityFeedResult> {
  await requireAdmin()
  const fromDate = input.fromDate ? new Date(input.fromDate) : null
  const toDate = input.toDate
    ? new Date(`${input.toDate}T23:59:59`)
    : null
  return listFeed({
    page: input.page,
    limit: input.limit,
    actorIds: input.actorIds,
    sources: input.sources,
    fromDate,
    toDate,
  })
}

export interface ActorOption {
  id: string
  name: string | null
  email: string
}

export async function fetchActivityActorsAction(): Promise<ActorOption[]> {
  await requireAdmin()
  return listActors()
}

import { requireAdmin } from '@/lib/auth/get-user'
import { ActivityShell } from '@/components/admin/activity/activity-shell'
import {
  fetchActivityActorsAction,
  fetchActivityFeedAction,
} from './actions'

export const dynamic = 'force-dynamic'

export default async function AdminActivityPage() {
  await requireAdmin()
  const [initialFeed, actors] = await Promise.all([
    fetchActivityFeedAction({ page: 1, limit: 50 }),
    fetchActivityActorsAction(),
  ])
  return <ActivityShell initialFeed={initialFeed} actors={actors} />
}

// Cross-domain activity feed for /admin/activity.
//
// The AuditLog table captures anything that mutates state and
// matters to an admin but wasn't already covered by a domain-
// specific log (member/settings/course/membership/employee/
// certificate). Domains that already keep their own audit
// (Tasks, Policies, Org board, Announcements, Logins) stay as
// they are — this service reads from them too and stitches
// everything into one timeline.
//
// Design notes:
//  - Merging across N unrelated tables can't paginate with a
//    cursor. We over-fetch per source (bounded by MAX_PER_SOURCE)
//    and paginate the merged list in memory. Filters push down
//    to each source so a narrow query still scales.
//  - actorId is nullable — system-triggered writes (background
//    jobs, automations) have no human actor. The UI shows
//    "System" for those rows.
//  - `action` is a dot-namespaced token so the filter can group
//    naturally: "member.create", "settings.branding.update".

import { prisma } from '@/lib/prisma'
import { runAsSuperAdmin } from '@/lib/tenancy/request-company'

export type EventSource =
  | 'audit'
  | 'task'
  | 'policy'
  | 'org'
  | 'announcement'
  | 'login'

export interface FeedEvent {
  id: string
  source: EventSource
  action: string
  resourceType: string
  resourceId: string | null
  summary: string
  actor: { id: string; name: string | null; email: string } | null
  createdAt: Date
}

interface ListFeedOptions {
  page?: number
  limit?: number
  actorIds?: string[]
  sources?: EventSource[]
  fromDate?: Date | null
  toDate?: Date | null
}

/** Over-fetch cap per source. Merged feed sorts + slices in
 *  memory, so this is the ceiling on how far back a single page
 *  can reach across all sources. Bumped if a tenant has many
 *  active domains. */
const MAX_PER_SOURCE = 500

// ============================================
// WRITE
// ============================================

interface WriteInput {
  actorId: string | null
  action: string
  resourceType: string
  resourceId?: string | null
  summary: string
  metadata?: Record<string, unknown> | null
}

/**
 * Insert a new audit-log row. Callers pass through service-side
 * (not action-side) so instrumentation lives next to the write
 * that just succeeded. Failures are swallowed with a console
 * warning — an audit-log write should never block a user action.
 */
export async function writeAuditLog(input: WriteInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        summary: input.summary,
        metadata: (input.metadata ?? undefined) as never,
      },
    })
  } catch (err) {
    console.warn('[audit-log] write failed:', err)
  }
}

// ============================================
// READ
// ============================================

/** Actors that show up in the feed for the picker. Union of every
 *  distinct actor across the source tables, capped for legibility. */
export async function listActors(): Promise<
  Array<{ id: string; name: string | null; email: string }>
> {
  return runAsSuperAdmin(() =>
    prisma.user.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
      take: 500,
    }),
  )
}

/**
 * Unified feed reader. Pulls each source in parallel, maps to the
 * common shape, sorts by createdAt desc, and returns a page slice.
 * Filters push down when applicable; source filter shortcuts the
 * per-source fetch entirely when a source is excluded.
 */
export async function listFeed(
  options: ListFeedOptions = {},
): Promise<{
  items: FeedEvent[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}> {
  const {
    page = 1,
    limit = 50,
    actorIds,
    sources,
    fromDate = null,
    toDate = null,
  } = options

  const includeSource = (s: EventSource) =>
    !sources || sources.length === 0 || sources.includes(s)

  const dateRangeCommon = (createdAtField: string) => {
    const where: Record<string, unknown> = {}
    if (fromDate) (where[createdAtField] ??= {}) as Record<string, unknown>
    if (toDate) (where[createdAtField] ??= {}) as Record<string, unknown>
    const range: Record<string, Date> = {}
    if (fromDate) range.gte = fromDate
    if (toDate) range.lte = toDate
    if (Object.keys(range).length) where[createdAtField] = range
    return where
  }
  const actorClause = (actorField: string) =>
    actorIds && actorIds.length > 0 ? { [actorField]: { in: actorIds } } : {}

  const [
    audit,
    tasks,
    policies,
    orgs,
    announcements,
    logins,
  ] = await Promise.all([
    includeSource('audit')
      ? prisma.auditLog.findMany({
          where: {
            ...dateRangeCommon('createdAt'),
            ...actorClause('actorId'),
          },
          orderBy: { createdAt: 'desc' },
          take: MAX_PER_SOURCE,
          include: { actor: { select: { id: true, name: true, email: true } } },
        })
      : Promise.resolve([]),
    includeSource('task')
      ? prisma.taskActivityLog.findMany({
          where: {
            ...dateRangeCommon('createdAt'),
            ...actorClause('actorId'),
          },
          orderBy: { createdAt: 'desc' },
          take: MAX_PER_SOURCE,
          include: {
            actor: { select: { id: true, name: true, email: true } },
            task: { select: { id: true, title: true } },
          },
        })
      : Promise.resolve([]),
    includeSource('policy')
      ? prisma.policyActivityLog.findMany({
          where: {
            ...dateRangeCommon('createdAt'),
            ...actorClause('actorId'),
          },
          orderBy: { createdAt: 'desc' },
          take: MAX_PER_SOURCE,
          include: {
            actor: { select: { id: true, name: true, email: true } },
            policy: { select: { id: true, title: true } },
          },
        })
      : Promise.resolve([]),
    includeSource('org')
      ? prisma.orgNodeAuditLog.findMany({
          where: {
            ...dateRangeCommon('createdAt'),
            ...actorClause('actorUserId'),
          },
          orderBy: { createdAt: 'desc' },
          take: MAX_PER_SOURCE,
          include: {
            actor: { select: { id: true, name: true, email: true } },
          },
        })
      : Promise.resolve([]),
    includeSource('announcement')
      ? prisma.announcementAuditLog.findMany({
          where: {
            ...dateRangeCommon('createdAt'),
            ...actorClause('userId'),
          },
          orderBy: { createdAt: 'desc' },
          take: MAX_PER_SOURCE,
          include: {
            user: { select: { id: true, name: true, email: true } },
            announcement: { select: { id: true, title: true } },
          },
        })
      : Promise.resolve([]),
    includeSource('login')
      ? prisma.loginEvent.findMany({
          where: {
            ...dateRangeCommon('loginAt'),
            ...actorClause('userId'),
          },
          orderBy: { loginAt: 'desc' },
          take: MAX_PER_SOURCE,
          include: { user: { select: { id: true, name: true, email: true } } },
        })
      : Promise.resolve([]),
  ])

  const events: FeedEvent[] = [
    ...audit.map(fromAudit),
    ...tasks.map(fromTask),
    ...policies.map(fromPolicy),
    ...orgs.map(fromOrg),
    ...announcements.map(fromAnnouncement),
    ...logins.map(fromLogin),
  ]

  events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  const start = (page - 1) * limit
  const items = events.slice(start, start + limit)
  return {
    items,
    total: events.length,
    page,
    limit,
    hasMore: start + limit < events.length,
  }
}

// ============================================
// MAPPERS — normalize each source into FeedEvent
// ============================================

type ActorRow = { id: string; name: string | null; email: string } | null

function fromAudit(row: {
  id: string
  action: string
  resourceType: string
  resourceId: string | null
  summary: string
  createdAt: Date
  actor: ActorRow
}): FeedEvent {
  return {
    id: `audit:${row.id}`,
    source: 'audit',
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    summary: row.summary,
    actor: row.actor,
    createdAt: row.createdAt,
  }
}

function fromTask(row: {
  id: string
  action: string
  createdAt: Date
  actor: ActorRow
  task: { id: string; title: string } | null
}): FeedEvent {
  const title = row.task?.title ?? '(deleted task)'
  return {
    id: `task:${row.id}`,
    source: 'task',
    action: `task.${row.action}`,
    resourceType: 'task',
    resourceId: row.task?.id ?? null,
    summary: `${humanizeTaskAction(row.action)} "${title}"`,
    actor: row.actor,
    createdAt: row.createdAt,
  }
}

function fromPolicy(row: {
  id: string
  action: string
  createdAt: Date
  actor: ActorRow
  policy: { id: string; title: string } | null
}): FeedEvent {
  const title = row.policy?.title ?? '(deleted policy)'
  return {
    id: `policy:${row.id}`,
    source: 'policy',
    action: `policy.${row.action}`,
    resourceType: 'policy',
    resourceId: row.policy?.id ?? null,
    summary: `${humanizePolicyAction(row.action)} "${title}"`,
    actor: row.actor,
    createdAt: row.createdAt,
  }
}

function fromOrg(row: {
  id: string
  action: string
  createdAt: Date
  actor: ActorRow
  nodeId: string | null
}): FeedEvent {
  return {
    id: `org:${row.id}`,
    source: 'org',
    action: `org.${row.action}`,
    resourceType: 'orgNode',
    resourceId: row.nodeId,
    summary: humanizeOrgAction(row.action),
    actor: row.actor,
    createdAt: row.createdAt,
  }
}

function fromAnnouncement(row: {
  id: string
  action: string
  createdAt: Date
  user: ActorRow
  announcement: { id: string; title: string } | null
}): FeedEvent {
  const title = row.announcement?.title ?? '(deleted announcement)'
  return {
    id: `ann:${row.id}`,
    source: 'announcement',
    action: `announcement.${row.action}`,
    resourceType: 'announcement',
    resourceId: row.announcement?.id ?? null,
    summary: `${humanizeAnnouncementAction(row.action)} "${title}"`,
    actor: row.user,
    createdAt: row.createdAt,
  }
}

function fromLogin(row: {
  id: string
  loginAt: Date
  user: ActorRow
}): FeedEvent {
  return {
    id: `login:${row.id}`,
    source: 'login',
    action: 'auth.login',
    resourceType: 'session',
    resourceId: null,
    summary: `Signed in as ${row.user?.name?.trim() || row.user?.email || 'unknown'}`,
    actor: row.user,
    createdAt: row.loginAt,
  }
}

// ============================================
// Small dictionaries so the feed reads naturally.
// New per-module actions get a default sentence via
// humanize(); we only bespoke phrasing where it helps.
// ============================================

function humanizeTaskAction(action: string): string {
  switch (action) {
    case 'created':
      return 'Created task'
    case 'status_changed':
      return 'Changed status on'
    case 'assigned':
      return 'Reassigned'
    case 'archived':
      return 'Archived task'
    case 'restored':
      return 'Restored task'
    case 'deleted':
      return 'Deleted task'
    case 'priority_changed':
      return 'Changed priority on'
    case 'labels_changed':
      return 'Changed labels on'
    case 'due_date_changed':
      return 'Changed due date on'
    default:
      return `Updated (${action})`
  }
}

function humanizePolicyAction(action: string): string {
  switch (action) {
    case 'created':
      return 'Created policy'
    case 'updated':
      return 'Updated policy'
    case 'published':
      return 'Published policy'
    case 'archived':
      return 'Archived policy'
    case 'restored':
      return 'Restored policy'
    case 'deleted':
      return 'Deleted policy'
    default:
      return `Updated (${action})`
  }
}

function humanizeOrgAction(action: string): string {
  switch (action) {
    case 'created':
      return 'Created an org-board node'
    case 'updated':
      return 'Updated an org-board node'
    case 'deleted':
      return 'Deleted an org-board node'
    case 'moved':
      return 'Moved an org-board node'
    default:
      return `Org board: ${action}`
  }
}

function humanizeAnnouncementAction(action: string): string {
  switch (action) {
    case 'created':
      return 'Drafted announcement'
    case 'published':
      return 'Published announcement'
    case 'updated':
      return 'Edited announcement'
    case 'archived':
      return 'Archived announcement'
    case 'deleted':
      return 'Deleted announcement'
    default:
      return `Announcement: ${action}`
  }
}

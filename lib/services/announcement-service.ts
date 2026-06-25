import {
  Prisma,
  type AnnouncementAuditAction,
  type AnnouncementCategory,
  type AnnouncementStatus,
} from '@prisma/client'
import { revalidatePath, unstable_cache, updateTag } from 'next/cache'

import { prisma } from '@/lib/prisma'
import type {
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
} from '@/lib/validations/announcement'

// Single tag that invalidates every cached unread-count read across
// every user. Cheap blunt instrument: announcements change rarely
// (admin authoring action), so wiping the whole cache on a create /
// publish / delete is acceptable.
export const UNREAD_COUNT_CACHE_TAG = 'announcement-unread-counts'

export type AnnouncementView = 'active' | 'deleted'

interface ListAnnouncementsOptions {
  search?: string
  status?: AnnouncementStatus | null
  category?: AnnouncementCategory | null
  view?: AnnouncementView
  page: number
  limit: number
  /** Restrict to non-archived rows. Member-side defaults to true;
   *  admin list keeps archived rows visible for management. */
  excludeArchived?: boolean
}

const DEFAULT_PAGE_SIZE = 10

function buildWhere(
  opts: ListAnnouncementsOptions,
): Prisma.AnnouncementWhereInput {
  const { search, status, category, view = 'active', excludeArchived } = opts

  const baseWhere: Prisma.AnnouncementWhereInput =
    view === 'deleted' ? { deletedAt: { not: null } } : { deletedAt: null }

  const filters: Prisma.AnnouncementWhereInput = {}
  if (status) filters.status = status
  if (category) filters.category = category
  if (excludeArchived) filters.archivedAt = null

  const searchWhere: Prisma.AnnouncementWhereInput | undefined = search?.trim()
    ? {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { body: { contains: search, mode: 'insensitive' } },
        ],
      }
    : undefined

  return {
    AND: [baseWhere, filters, ...(searchWhere ? [searchWhere] : [])],
  }
}

const announcementListSelect = {
  id: true,
  title: true,
  body: true,
  status: true,
  category: true,
  pinned: true,
  scheduledAt: true,
  archivedAt: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  createdBy: true,
  createdByUser: {
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      role: true,
    },
  },
  reactions: {
    select: { emoji: true, userId: true },
  },
} satisfies Prisma.AnnouncementSelect

export interface ReadsBreakdown {
  admin: number
  team: number
  member: number
  total: number
}

async function listAnnouncements(options: ListAnnouncementsOptions) {
  const { page, limit } = options
  const where = buildWhere(options)
  const skip = (page - 1) * limit

  const [items, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      skip,
      take: limit,
      // Pinned rows always sort first regardless of date. Drafts (no
      // publishedAt) sink to the bottom; tie-break on createdAt so
      // the most recently authored draft floats up first.
      orderBy: [
        { pinned: 'desc' },
        { publishedAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      select: announcementListSelect,
    }),
    prisma.announcement.count({ where }),
  ])

  // Enrich each item with a reads-by-role breakdown so the admin
  // list can show "X admin / Y team / Z member" in a tooltip. Single
  // join keyed on announcementId — N+1-safe.
  const ids = items.map((i) => i.id)
  const reads =
    ids.length === 0
      ? []
      : await prisma.announcementRead.findMany({
          where: { announcementId: { in: ids } },
          select: {
            announcementId: true,
            user: { select: { role: true } },
          },
        })

  const breakdownById = new Map<string, ReadsBreakdown>()
  for (const id of ids) {
    breakdownById.set(id, { admin: 0, team: 0, member: 0, total: 0 })
  }
  for (const r of reads) {
    const b = breakdownById.get(r.announcementId)
    if (!b) continue
    b.total++
    if (r.user.role === 'ADMIN') b.admin++
    else if (r.user.role === 'TEAM') b.team++
    else b.member++
  }

  return {
    items: items.map((item) => ({
      ...item,
      reads: breakdownById.get(item.id) ?? {
        admin: 0,
        team: 0,
        member: 0,
        total: 0,
      },
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

async function getCounts() {
  const [groups, deleted] = await Promise.all([
    prisma.announcement.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.announcement.count({ where: { deletedAt: { not: null } } }),
  ])

  const totals = { all: 0, draft: 0, published: 0, deleted }
  for (const g of groups) {
    const n = g._count._all
    totals.all += n
    if (g.status === 'DRAFT') totals.draft += n
    if (g.status === 'PUBLISHED') totals.published += n
  }
  return totals
}

async function getAnnouncementById(id: string) {
  return prisma.announcement.findFirst({
    where: { id, deletedAt: null },
    select: announcementListSelect,
  })
}

async function createAnnouncement(
  input: CreateAnnouncementInput,
  createdBy: string | null,
) {
  return prisma.announcement.create({
    data: {
      title: input.title,
      body: input.body,
      status: input.status,
      category: input.category ?? 'GENERAL',
      pinned: input.pinned ?? false,
      // SCHEDULED rows carry a scheduledAt; PUBLISHED rows carry a
      // publishedAt and never a scheduledAt. DRAFT carries neither.
      scheduledAt: input.status === 'SCHEDULED' ? input.scheduledAt ?? null : null,
      publishedAt: input.status === 'PUBLISHED' ? new Date() : null,
      createdBy: createdBy ?? null,
    },
    select: announcementListSelect,
  })
}

async function updateAnnouncement(id: string, input: UpdateAnnouncementInput) {
  // Stamp publishedAt on the FIRST publish transition. A row that's
  // been published before keeps its original publishedAt across edits
  // (a content tweak shouldn't reset the "published on" date), and
  // un-publishing keeps publishedAt too so the timestamp survives a
  // round-trip to DRAFT and back.
  const existing = await prisma.announcement.findFirst({
    where: { id, deletedAt: null },
    select: { publishedAt: true },
  })
  if (!existing) return null

  const data: Prisma.AnnouncementUpdateInput = {}
  if (input.title !== undefined) data.title = input.title
  if (input.body !== undefined) data.body = input.body
  if (input.category !== undefined) data.category = input.category
  if (input.pinned !== undefined) data.pinned = input.pinned
  if (input.scheduledAt !== undefined) data.scheduledAt = input.scheduledAt
  if (input.status !== undefined) {
    data.status = input.status
    if (input.status === 'PUBLISHED' && existing.publishedAt === null) {
      data.publishedAt = new Date()
    }
    // Going SCHEDULED clears any prior publishedAt only on a never-
    // published row (keeps the original stamp through DRAFT round-
    // trips, matches existing publishedAt-preservation logic).
    if (input.status === 'SCHEDULED' && existing.publishedAt === null) {
      data.publishedAt = null
    }
    // Going DRAFT / PUBLISHED clears scheduledAt — only SCHEDULED
    // rows hold one.
    if (input.status !== 'SCHEDULED') data.scheduledAt = null
  }

  return prisma.announcement.update({
    where: { id },
    data,
    select: announcementListSelect,
  })
}

async function softDeleteAnnouncement(id: string) {
  return prisma.announcement.update({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date() },
    select: { id: true },
  })
}

async function restoreAnnouncement(id: string) {
  return prisma.announcement.update({
    where: { id, deletedAt: { not: null } },
    data: { deletedAt: null },
    select: { id: true },
  })
}

async function archiveAnnouncement(id: string) {
  return prisma.announcement.update({
    where: { id, deletedAt: null },
    data: { archivedAt: new Date() },
    select: { id: true },
  })
}

async function unarchiveAnnouncement(id: string) {
  return prisma.announcement.update({
    where: { id, deletedAt: null, archivedAt: { not: null } },
    data: { archivedAt: null },
    select: { id: true },
  })
}

// Reactions —————————————————————————————————————————————————————

async function toggleReaction(
  userId: string,
  announcementId: string,
  emoji: string,
): Promise<{ added: boolean }> {
  const existing = await prisma.announcementReaction.findUnique({
    where: { announcementId_userId_emoji: { announcementId, userId, emoji } },
    select: { id: true },
  })
  if (existing) {
    await prisma.announcementReaction.delete({ where: { id: existing.id } })
    return { added: false }
  }
  await prisma.announcementReaction.create({
    data: { announcementId, userId, emoji },
  })
  return { added: true }
}

// Comments —————————————————————————————————————————————————————

async function listComments(announcementId: string) {
  return prisma.announcementComment.findMany({
    where: { announcementId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      body: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          role: true,
        },
      },
    },
  })
}

async function createComment(
  announcementId: string,
  userId: string,
  body: string,
) {
  return prisma.announcementComment.create({
    data: { announcementId, userId, body },
    select: { id: true },
  })
}

async function softDeleteComment(commentId: string, requesterId: string) {
  // Owners can soft-delete their own; admins / team can soft-delete
  // anyone's. The caller (action layer) enforces the auth check —
  // here we just respect a non-null deletedAt as idempotent.
  return prisma.announcementComment.update({
    where: { id: commentId, deletedAt: null },
    data: { deletedAt: new Date() },
    select: { id: true, userId: true },
  })
}

// Audit log —————————————————————————————————————————————————————

async function recordAudit(
  announcementId: string,
  userId: string | null,
  action: AnnouncementAuditAction,
  metadata?: Prisma.InputJsonValue,
) {
  return prisma.announcementAuditLog.create({
    data: {
      announcementId,
      userId,
      action,
      metadata: metadata ?? Prisma.JsonNull,
    },
    select: { id: true },
  })
}

async function listAuditLogs(announcementId: string) {
  return prisma.announcementAuditLog.findMany({
    where: { announcementId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      action: true,
      metadata: true,
      createdAt: true,
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  })
}

// Scheduled publish — meant to be called from a cron route. Flips
// every SCHEDULED row whose scheduledAt has come due to PUBLISHED.
async function publishDueScheduled(): Promise<{ count: number; ids: string[] }> {
  const due = await prisma.announcement.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { lte: new Date() },
      deletedAt: null,
    },
    select: { id: true },
  })
  if (due.length === 0) return { count: 0, ids: [] }
  const ids = due.map((d) => d.id)
  await prisma.announcement.updateMany({
    where: { id: { in: ids } },
    data: {
      status: 'PUBLISHED',
      publishedAt: new Date(),
      scheduledAt: null,
    },
  })
  return { count: ids.length, ids }
}

// Auto-archive — flips every PUBLISHED, non-archived, non-deleted
// row whose publishedAt is older than `olderThanDays` to archived.
async function autoArchiveOlderThan(olderThanDays: number): Promise<number> {
  if (olderThanDays <= 0) return 0
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)
  const result = await prisma.announcement.updateMany({
    where: {
      status: 'PUBLISHED',
      archivedAt: null,
      deletedAt: null,
      publishedAt: { lt: cutoff },
    },
    data: { archivedAt: new Date() },
  })
  return result.count
}

// "New since your last visit" — bumps the user's
// announcementsLastSeenAt to now. Member-side page calls this AFTER
// rendering so unread items stay above the divider for THIS render.
async function touchAnnouncementsLastSeen(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { announcementsLastSeenAt: new Date() },
  })
}

// Best-effort batch mark-as-read for the member-side page. Uses
// createMany with skipDuplicates so the (userId, announcementId)
// unique constraint silently drops rows the member has already
// seen — no extra round-trip to figure out which ones to insert.
async function markAsRead(userId: string, announcementIds: string[]) {
  if (announcementIds.length === 0) return
  const result = await prisma.announcementRead.createMany({
    data: announcementIds.map((announcementId) => ({
      userId,
      announcementId,
    })),
    skipDuplicates: true,
  })
  // If anything actually got written, the user's unread count just
  // dropped — wipe the cache so the Bell badge reflects it on the
  // next page render instead of waiting for the 60s TTL. Also bust
  // the /dashboard Router Cache so its "Recent announcements" list
  // shows the now-read items without their unread dot on next nav.
  if (result.count > 0) {
    updateTag(UNREAD_COUNT_CACHE_TAG)
    revalidatePath('/dashboard')
  }
}

// Powers the unread-count badge on the top-bar Bell icon. Counts
// published, non-deleted announcements the user hasn't opened yet.
// Single round-trip — two parallel counts, subtract.
async function fetchUnreadCount(userId: string): Promise<number> {
  const baseWhere = { status: 'PUBLISHED', deletedAt: null } as const
  const [total, read] = await Promise.all([
    prisma.announcement.count({ where: baseWhere }),
    prisma.announcementRead.count({
      where: { userId, announcement: baseWhere },
    }),
  ])
  return Math.max(0, total - read)
}

// Cache the per-user unread count for 60s. The Bell badge is fetched
// in BOTH the (user) and (admin) layouts — every page nav was firing
// two DB round-trips before, and on the current iad1 ↔ Singapore
// path each one costs ~250 ms. The cache key is the user id; the
// shared tag UNREAD_COUNT_CACHE_TAG is wiped on any announcement
// write so a freshly-published row bumps badges sooner than 60s.
const getUnreadCount = unstable_cache(
  (userId: string) => fetchUnreadCount(userId),
  ['announcement-unread-count'],
  { tags: [UNREAD_COUNT_CACHE_TAG], revalidate: 60 },
)

// Powers the admin "who's read this?" drill-down. Reads grouped by
// role for the breakdown header + each user's display fields for the
// rendered list. Pre-sorted by readAt desc so the modal shows the
// most recent at top.
async function getReaders(announcementId: string) {
  const rows = await prisma.announcementRead.findMany({
    where: { announcementId },
    select: {
      readAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          role: true,
        },
      },
    },
    orderBy: { readAt: 'desc' },
  })
  return rows.map((r) => ({
    id: r.user.id,
    name: r.user.name,
    email: r.user.email,
    avatarUrl: r.user.avatarUrl,
    role: r.user.role,
    readAt: r.readAt,
  }))
}

export const announcementService = {
  list: listAnnouncements,
  counts: getCounts,
  getById: getAnnouncementById,
  create: createAnnouncement,
  update: updateAnnouncement,
  softDelete: softDeleteAnnouncement,
  restore: restoreAnnouncement,
  archive: archiveAnnouncement,
  unarchive: unarchiveAnnouncement,
  markAsRead,
  getUnreadCount,
  getReaders,
  // Reactions
  toggleReaction,
  // Comments
  listComments,
  createComment,
  softDeleteComment,
  // Audit
  recordAudit,
  listAuditLogs,
  // Cron-side helpers
  publishDueScheduled,
  autoArchiveOlderThan,
  // Member-side
  touchAnnouncementsLastSeen,
  defaultPageSize: DEFAULT_PAGE_SIZE,
}

export type AnnouncementListItem = Awaited<
  ReturnType<typeof listAnnouncements>
>['items'][number]
export type AnnouncementCounts = Awaited<ReturnType<typeof getCounts>>
export type AnnouncementDetail = NonNullable<
  Awaited<ReturnType<typeof getAnnouncementById>>
>
export type AnnouncementReader = Awaited<ReturnType<typeof getReaders>>[number]

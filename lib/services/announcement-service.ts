import { Prisma, type AnnouncementStatus } from '@prisma/client'
import { unstable_cache, updateTag } from 'next/cache'

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
  view?: AnnouncementView
  page: number
  limit: number
}

const DEFAULT_PAGE_SIZE = 10

function buildWhere(
  opts: ListAnnouncementsOptions,
): Prisma.AnnouncementWhereInput {
  const { search, status, view = 'active' } = opts

  const baseWhere: Prisma.AnnouncementWhereInput =
    view === 'deleted' ? { deletedAt: { not: null } } : { deletedAt: null }

  const filters: Prisma.AnnouncementWhereInput = {}
  if (status) filters.status = status

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
      // Drafts (no publishedAt) sink to the bottom; tie-break on
      // createdAt so the most recently authored draft floats up first.
      orderBy: [
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
  if (input.status !== undefined) {
    data.status = input.status
    if (input.status === 'PUBLISHED' && existing.publishedAt === null) {
      data.publishedAt = new Date()
    }
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
  // next page render instead of waiting for the 60s TTL.
  if (result.count > 0) updateTag(UNREAD_COUNT_CACHE_TAG)
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
  markAsRead,
  getUnreadCount,
  getReaders,
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

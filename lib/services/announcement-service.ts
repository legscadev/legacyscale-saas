import { Prisma, type AnnouncementStatus } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type {
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
} from '@/lib/validations/announcement'

export type AnnouncementView = 'active' | 'deleted'

interface ListAnnouncementsOptions {
  search?: string
  status?: AnnouncementStatus | null
  view?: AnnouncementView
  page: number
  limit: number
}

const DEFAULT_PAGE_SIZE = 20

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
  _count: { select: { reads: true } },
} satisfies Prisma.AnnouncementSelect

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

  return {
    items,
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

async function createAnnouncement(input: CreateAnnouncementInput) {
  return prisma.announcement.create({
    data: {
      title: input.title,
      body: input.body,
      status: input.status,
      publishedAt: input.status === 'PUBLISHED' ? new Date() : null,
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
  await prisma.announcementRead.createMany({
    data: announcementIds.map((announcementId) => ({
      userId,
      announcementId,
    })),
    skipDuplicates: true,
  })
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
  defaultPageSize: DEFAULT_PAGE_SIZE,
}

export type AnnouncementListItem = Awaited<
  ReturnType<typeof listAnnouncements>
>['items'][number]
export type AnnouncementCounts = Awaited<ReturnType<typeof getCounts>>
export type AnnouncementDetail = NonNullable<
  Awaited<ReturnType<typeof getAnnouncementById>>
>

import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

const chapterListSelect = {
  id: true,
  courseId: true,
  title: true,
  orderIndex: true,
  createdAt: true,
  updatedAt: true,
  lessons: {
    where: { deletedAt: null },
    orderBy: { orderIndex: 'asc' as const },
    select: {
      id: true,
      chapterId: true,
      title: true,
      description: true,
      type: true,
      status: true,
      orderIndex: true,
      durationSeconds: true,
      muxPlaybackId: true,
      resourceUrl: true,
      resourceName: true,
      resourceSize: true,
    },
  },
} as const

async function listByCourse(courseId: string) {
  return prisma.chapter.findMany({
    where: { courseId, deletedAt: null },
    orderBy: { orderIndex: 'asc' },
    select: chapterListSelect,
  })
}

interface CreateChapterInput {
  courseId: string
  title: string
}

async function createChapter({ courseId, title }: CreateChapterInput) {
  // Find the next orderIndex among non-deleted siblings — soft-deleted
  // rows are excluded so the new chapter slots in at the end of the
  // visible list.
  const last = await prisma.chapter.findFirst({
    where: { courseId, deletedAt: null },
    orderBy: { orderIndex: 'desc' },
    select: { orderIndex: true },
  })
  const orderIndex = (last?.orderIndex ?? -1) + 1

  return prisma.chapter.create({
    data: { courseId, title, orderIndex },
    select: chapterListSelect,
  })
}

interface UpdateChapterInput {
  title?: string
  orderIndex?: number
}

async function updateChapter(id: string, input: UpdateChapterInput) {
  const data: Prisma.ChapterUpdateInput = {}
  if (input.title !== undefined) data.title = input.title
  if (input.orderIndex !== undefined) data.orderIndex = input.orderIndex

  return prisma.chapter.update({
    where: { id },
    data,
    select: chapterListSelect,
  })
}

/**
 * Hard delete — schema cascade removes nested lessons (verified in 2.0a).
 * Mux assets on video lessons are NOT cleaned up here; that's a known
 * follow-up tracked in PHASE_C_CHAPTER_SLICE.md.
 */
async function deleteChapter(id: string) {
  return prisma.chapter.delete({ where: { id }, select: { id: true } })
}

/**
 * Bulk reorder via a single transaction. Caller is responsible for the
 * ordering of `orderedIds`; we just rewrite orderIndex to match the
 * array position. Any id not in the list is left alone.
 */
async function reorderChapters(courseId: string, orderedIds: string[]) {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.chapter.update({
        where: { id, courseId },
        data: { orderIndex: index },
      }),
    ),
  )
}

export const chapterService = {
  list: listByCourse,
  create: createChapter,
  update: updateChapter,
  delete: deleteChapter,
  reorder: reorderChapters,
}

export type ChapterListItem = Awaited<
  ReturnType<typeof listByCourse>
>[number]
export type LessonListItem = ChapterListItem['lessons'][number]

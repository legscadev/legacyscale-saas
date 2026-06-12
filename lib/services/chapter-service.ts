import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

const chapterListSelect = {
  id: true,
  courseId: true,
  moduleId: true,
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
      resources: {
        orderBy: { createdAt: 'asc' as const },
        select: {
          id: true,
          lessonId: true,
          name: true,
          size: true,
          mimeType: true,
          createdAt: true,
        },
      },
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
  // null/missing → loose chapter (sits directly on the course).
  // A UUID → chapter belongs to that module. orderIndex is scoped to
  // the parent (module or course top-level), so a new loose chapter
  // and a new chapter in module X both get the next slot in their own
  // ordering space.
  moduleId?: string | null
  title: string
}

async function createChapter({
  courseId,
  moduleId,
  title,
}: CreateChapterInput) {
  const siblingWhere: Prisma.ChapterWhereInput = {
    courseId,
    moduleId: moduleId ?? null,
    deletedAt: null,
  }
  const last = await prisma.chapter.findFirst({
    where: siblingWhere,
    orderBy: { orderIndex: 'desc' },
    select: { orderIndex: true },
  })
  const orderIndex = (last?.orderIndex ?? -1) + 1

  return prisma.chapter.create({
    data: { courseId, moduleId: moduleId ?? null, title, orderIndex },
    select: chapterListSelect,
  })
}

interface UpdateChapterInput {
  title?: string
  orderIndex?: number
  // `undefined` = no change. `null` = move out to loose. A UUID =
  // move into that module. Use moveChapter() to also auto-bump
  // orderIndex into the new scope; this method trusts whatever the
  // caller passes.
  moduleId?: string | null
}

async function updateChapter(id: string, input: UpdateChapterInput) {
  const data: Prisma.ChapterUpdateInput = {}
  if (input.title !== undefined) data.title = input.title
  if (input.orderIndex !== undefined) data.orderIndex = input.orderIndex
  if (input.moduleId !== undefined) {
    data.module =
      input.moduleId === null
        ? { disconnect: true }
        : { connect: { id: input.moduleId } }
  }

  return prisma.chapter.update({
    where: { id },
    data,
    select: chapterListSelect,
  })
}

/**
 * Move a chapter between parents (module → module, module → loose,
 * or loose → module) and slot it at the end of the new scope's
 * ordering. Use when the caller doesn't want to think about the new
 * orderIndex value.
 */
async function moveChapter(id: string, moduleId: string | null) {
  const chapter = await prisma.chapter.findUnique({
    where: { id },
    select: { courseId: true },
  })
  if (!chapter) throw new Error('Chapter not found')

  const last = await prisma.chapter.findFirst({
    where: { courseId: chapter.courseId, moduleId, deletedAt: null },
    orderBy: { orderIndex: 'desc' },
    select: { orderIndex: true },
  })
  const orderIndex = (last?.orderIndex ?? -1) + 1

  return prisma.chapter.update({
    where: { id },
    data: {
      module:
        moduleId === null
          ? { disconnect: true }
          : { connect: { id: moduleId } },
      orderIndex,
    },
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
  move: moveChapter,
  delete: deleteChapter,
  reorder: reorderChapters,
}

export type ChapterListItem = Awaited<
  ReturnType<typeof listByCourse>
>[number]
export type LessonListItem = ChapterListItem['lessons'][number]
export type LessonResourceItem = LessonListItem['resources'][number]

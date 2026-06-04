import type { LessonType, Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { deleteAsset as deleteMuxAsset } from '@/lib/mux'

const lessonRowSelect = {
  id: true,
  chapterId: true,
  title: true,
  type: true,
  status: true,
  orderIndex: true,
  durationSeconds: true,
} as const

interface CreateLessonInput {
  chapterId: string
  type: LessonType
  title?: string
}

const DEFAULT_TITLE: Record<LessonType, string> = {
  VIDEO: 'New video lesson',
  QUIZ: 'New quiz lesson',
  RESOURCE: 'New resource lesson',
}

async function createLesson({ chapterId, type, title }: CreateLessonInput) {
  const last = await prisma.lesson.findFirst({
    where: { chapterId, deletedAt: null },
    orderBy: { orderIndex: 'desc' },
    select: { orderIndex: true },
  })
  const orderIndex = (last?.orderIndex ?? -1) + 1

  return prisma.lesson.create({
    data: {
      chapterId,
      type,
      title: title ?? DEFAULT_TITLE[type],
      orderIndex,
    },
    select: lessonRowSelect,
  })
}

interface UpdateLessonInput {
  title?: string
  orderIndex?: number
}

async function updateLesson(id: string, input: UpdateLessonInput) {
  const data: Prisma.LessonUpdateInput = {}
  if (input.title !== undefined) data.title = input.title
  if (input.orderIndex !== undefined) data.orderIndex = input.orderIndex

  return prisma.lesson.update({
    where: { id },
    data,
    select: lessonRowSelect,
  })
}

/**
 * Hard delete. For VIDEO lessons we attempt to clean up the Mux asset
 * first so we don't accumulate orphans, but a Mux failure must not
 * block the DB delete — the row goes, the asset becomes manual cleanup.
 */
async function deleteLesson(id: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    select: { id: true, type: true, muxAssetId: true },
  })
  if (!lesson) return { id }

  if (lesson.type === 'VIDEO' && lesson.muxAssetId) {
    try {
      await deleteMuxAsset(lesson.muxAssetId)
    } catch (err) {
      console.error(
        `Mux delete failed for lesson ${id} asset ${lesson.muxAssetId}:`,
        err,
      )
    }
  }

  await prisma.lesson.delete({ where: { id } })
  return { id }
}

async function reorderLessons(chapterId: string, orderedIds: string[]) {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.lesson.update({
        where: { id, chapterId },
        data: { orderIndex: index },
      }),
    ),
  )
}

export const lessonService = {
  create: createLesson,
  update: updateLesson,
  delete: deleteLesson,
  reorder: reorderLessons,
}

export type LessonRow = Awaited<ReturnType<typeof createLesson>>

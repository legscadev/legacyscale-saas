import type { LessonType, Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { deleteAsset as deleteMuxAsset } from '@/lib/mux'
import { createAdminClient } from '@/lib/supabase/admin'

const RESOURCE_BUCKET = 'lesson-resources'

/**
 * Best-effort: removes every file under <lessonId>/ in the
 * lesson-resources bucket. Used when a RESOURCE lesson is deleted so
 * we don't accumulate orphan files. Errors are logged but never
 * thrown — losing a Storage object should not block the DB delete.
 */
export async function removeLessonResourceFolder(
  lessonId: string,
): Promise<void> {
  try {
    const supabase = createAdminClient()
    const { data: existing, error: listError } = await supabase.storage
      .from(RESOURCE_BUCKET)
      .list(lessonId)
    if (listError) {
      console.error(
        `Resource list failed for lesson ${lessonId}:`,
        listError,
      )
      return
    }
    if (!existing || existing.length === 0) return
    const paths = existing.map((f) => `${lessonId}/${f.name}`)
    const { error: removeError } = await supabase.storage
      .from(RESOURCE_BUCKET)
      .remove(paths)
    if (removeError) {
      console.error(
        `Resource remove failed for lesson ${lessonId}:`,
        removeError,
      )
    }
  } catch (err) {
    console.error(`Resource cleanup error for lesson ${lessonId}:`, err)
  }
}

const lessonRowSelect = {
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
 * Hard delete. Before the row goes, we attempt to clean up any
 * external assets the lesson owns:
 *   • VIDEO → delete the Mux asset (the upload bytes Mux is hosting).
 *   • RESOURCE → remove the file from the lesson-resources bucket.
 * Both side-effects are best-effort — failures log and the DB delete
 * still proceeds, leaving the asset/file as manual cleanup.
 */
async function deleteLesson(id: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    select: { id: true, type: true, muxAssetId: true, resourceUrl: true },
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

  if (lesson.type === 'RESOURCE' && lesson.resourceUrl) {
    await removeLessonResourceFolder(id)
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

import type { LessonType, Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { deleteAsset as deleteMuxAsset } from '@/lib/mux'
import { removeLessonResourceFolder } from './lesson-service'

/**
 * Sync the entire chapter + lesson tree of a course in one transaction.
 *
 * The client sends the *desired* state (what it wants to be true after
 * save). We diff against the current DB state and apply inserts /
 * updates / deletes accordingly. Temp ids on new rows are mapped to
 * real DB ids in the result so the client can swap them in.
 *
 * Mux assets on deleted VIDEO lessons are cleaned up best-effort —
 * failures are logged but don't fail the transaction (matches the
 * single-lesson delete posture).
 */
export interface SyncLessonInput {
  id?: string
  tempId?: string
  title: string
  description?: string | null
  type: LessonType
  orderIndex: number
}

export interface SyncChapterInput {
  id?: string
  tempId?: string
  title: string
  orderIndex: number
  lessons: SyncLessonInput[]
}

export interface SyncResult {
  chapterMappings: Array<{ tempId: string; realId: string }>
  lessonMappings: Array<{ tempId: string; realId: string }>
}

async function syncCourseStructure(
  courseId: string,
  chapters: SyncChapterInput[],
): Promise<SyncResult> {
  // Load current state outside the transaction for the external-asset
  // pre-pass — we need to know which Mux assets and Storage files to
  // delete. The actual DB diff happens inside the transaction with a
  // fresh read.
  const existingForCleanup = await prisma.chapter.findMany({
    where: { courseId, deletedAt: null },
    select: {
      id: true,
      lessons: {
        where: { deletedAt: null },
        select: {
          id: true,
          type: true,
          muxAssetId: true,
        },
      },
    },
  })

  const incomingChapterIds = new Set(
    chapters.filter((c) => c.id).map((c) => c.id!),
  )
  const incomingLessonIds = new Set(
    chapters.flatMap((c) => c.lessons.filter((l) => l.id).map((l) => l.id!)),
  )

  // External-asset cleanup pre-pass — lessons going away (either as
  // part of a chapter delete or individually) get their Mux asset
  // or resource file removed first. Both are best-effort: a Storage
  // or Mux failure logs but doesn't fail the structural sync.
  const lessonsBeingRemoved = existingForCleanup.flatMap((chapter) => {
    if (!incomingChapterIds.has(chapter.id)) return chapter.lessons
    return chapter.lessons.filter((l) => !incomingLessonIds.has(l.id))
  })
  for (const lesson of lessonsBeingRemoved) {
    if (lesson.type === 'VIDEO' && lesson.muxAssetId) {
      try {
        await deleteMuxAsset(lesson.muxAssetId)
      } catch (err) {
        console.error(
          `Mux delete failed for lesson ${lesson.id} asset ${lesson.muxAssetId}:`,
          err,
        )
      }
    }
    if (lesson.type === 'RESOURCE') {
      // Always attempt — the helper no-ops when the bucket folder is
      // empty, so we don't need to pre-check resourceUrl. Per-lesson
      // resources now live in a separate table that cascades on the
      // chapter/lesson delete; the bucket files need this explicit
      // sweep.
      await removeLessonResourceFolder(lesson.id)
    }
  }

  return prisma.$transaction(async (tx) => {
    const chapterMappings: SyncResult['chapterMappings'] = []
    const lessonMappings: SyncResult['lessonMappings'] = []

    // Delete chapters not in incoming. Cascade removes nested lessons.
    const chaptersToDelete = Array.from(incomingChapterIds)
    const existingIds = existingForCleanup.map((c) => c.id)
    const idsToDelete = existingIds.filter((id) => !incomingChapterIds.has(id))
    if (idsToDelete.length > 0) {
      await tx.chapter.deleteMany({ where: { id: { in: idsToDelete } } })
    }
    // Silence unused-var lint — chaptersToDelete is here for readability
    // but the actual filter is idsToDelete.
    void chaptersToDelete

    // Delete individual lessons that survived the chapter pass but
    // aren't in the incoming list.
    const survivingLessonIdsInDb = existingForCleanup
      .filter((c) => incomingChapterIds.has(c.id))
      .flatMap((c) => c.lessons.map((l) => l.id))
    const lessonIdsToDelete = survivingLessonIdsInDb.filter(
      (id) => !incomingLessonIds.has(id),
    )
    if (lessonIdsToDelete.length > 0) {
      await tx.lesson.deleteMany({ where: { id: { in: lessonIdsToDelete } } })
    }

    // Walk the incoming structure: update existing rows, create new
    // ones, track temp→real id mappings.
    for (const chapter of chapters) {
      let realChapterId: string

      if (chapter.id) {
        await tx.chapter.update({
          where: { id: chapter.id, courseId },
          data: { title: chapter.title, orderIndex: chapter.orderIndex },
        })
        realChapterId = chapter.id
      } else {
        const created = await tx.chapter.create({
          data: {
            courseId,
            title: chapter.title,
            orderIndex: chapter.orderIndex,
          },
          select: { id: true },
        })
        realChapterId = created.id
        if (chapter.tempId) {
          chapterMappings.push({ tempId: chapter.tempId, realId: created.id })
        }
      }

      for (const lesson of chapter.lessons) {
        if (lesson.id) {
          await tx.lesson.update({
            where: { id: lesson.id, chapterId: realChapterId },
            data: {
              title: lesson.title,
              description: lesson.description ?? null,
              orderIndex: lesson.orderIndex,
            },
          })
        } else {
          const created = await tx.lesson.create({
            data: {
              chapterId: realChapterId,
              type: lesson.type,
              title: lesson.title,
              description: lesson.description ?? null,
              orderIndex: lesson.orderIndex,
            } satisfies Prisma.LessonUncheckedCreateInput,
            select: { id: true },
          })
          if (lesson.tempId) {
            lessonMappings.push({ tempId: lesson.tempId, realId: created.id })
          }
        }
      }
    }

    return { chapterMappings, lessonMappings }
  }, {
    // Default Prisma interactive-transaction timeouts (5s wait + 5s
    // execute) are too tight on the Supabase transaction-mode pooler
    // for big course payloads — a real-world save of a course with
    // ~10+ chapters/lessons routinely takes 5–6s and trips P2028.
    // 30s gives plenty of headroom while still bounding any runaway
    // transaction.
    maxWait: 10_000,
    timeout: 30_000,
  })
}

export const courseStructureService = {
  sync: syncCourseStructure,
}

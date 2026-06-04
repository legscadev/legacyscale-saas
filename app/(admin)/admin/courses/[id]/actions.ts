'use server'

import { revalidatePath } from 'next/cache'
import { Prisma, type LessonType } from '@prisma/client'
import { z } from 'zod'

import { requireAdmin } from '@/lib/auth/get-user'
import {
  chapterService,
  type ChapterListItem,
  type LessonListItem,
} from '@/lib/services/chapter-service'
import { lessonService } from '@/lib/services/lesson-service'
import {
  courseStructureService,
  type SyncResult,
} from '@/lib/services/course-structure-service'
import {
  createChapterSchema,
  createLessonSchema,
  lessonTypeSchema,
  updateChapterSchema,
  updateLessonSchema,
} from '@/lib/validations/course'

interface BaseResult {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

export interface CreateChapterResult extends BaseResult {
  chapter?: ChapterListItem
}

export interface UpdateChapterResult extends BaseResult {
  chapter?: ChapterListItem
}

export interface CreateLessonResult extends BaseResult {
  lesson?: LessonListItem
}

export interface UpdateLessonResult extends BaseResult {
  lesson?: LessonListItem
}

const reorderSchema = z.object({
  courseId: z.uuid(),
  orderedIds: z.array(z.uuid()).min(1),
})

const reorderLessonsSchema = z.object({
  courseId: z.uuid(),
  chapterId: z.uuid(),
  orderedIds: z.array(z.uuid()).min(1),
})

function fieldErrorsFrom(error: z.ZodError) {
  const result: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    if (!result[key]) result[key] = []
    result[key]!.push(issue.message)
  }
  return result
}

// ===========================================================
// CREATE
// ===========================================================

export async function createChapterAction(
  courseId: string,
  title = 'New chapter',
): Promise<CreateChapterResult> {
  await requireAdmin()

  const parsed = createChapterSchema.safeParse({ courseId, title })
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) }
  }

  try {
    const chapter = await chapterService.create(parsed.data)
    revalidatePath(`/admin/courses/${courseId}`)
    return { ok: true, chapter }
  } catch (err) {
    console.error('Chapter create failed:', err)
    return { ok: false, error: 'Could not create chapter' }
  }
}

// ===========================================================
// UPDATE  (rename)
// ===========================================================

export async function updateChapterAction(
  chapterId: string,
  input: { title?: string; orderIndex?: number },
): Promise<UpdateChapterResult> {
  await requireAdmin()

  const parsed = updateChapterSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) }
  }

  try {
    const chapter = await chapterService.update(chapterId, parsed.data)
    revalidatePath(`/admin/courses/${chapter.courseId}`)
    return { ok: true, chapter }
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      return { ok: false, error: 'Chapter not found' }
    }
    console.error('Chapter update failed:', err)
    return { ok: false, error: 'Could not save chapter' }
  }
}

// ===========================================================
// DELETE
// ===========================================================

export async function deleteChapterAction(
  chapterId: string,
  courseId: string,
): Promise<BaseResult> {
  await requireAdmin()
  try {
    await chapterService.delete(chapterId)
    revalidatePath(`/admin/courses/${courseId}`)
    return { ok: true }
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      return { ok: false, error: 'Chapter not found' }
    }
    console.error('Chapter delete failed:', err)
    return { ok: false, error: 'Could not delete chapter' }
  }
}

// ===========================================================
// REORDER
// ===========================================================

export async function reorderChaptersAction(
  courseId: string,
  orderedIds: string[],
): Promise<BaseResult> {
  await requireAdmin()

  const parsed = reorderSchema.safeParse({ courseId, orderedIds })
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) }
  }

  try {
    await chapterService.reorder(parsed.data.courseId, parsed.data.orderedIds)
    revalidatePath(`/admin/courses/${courseId}`)
    return { ok: true }
  } catch (err) {
    console.error('Chapter reorder failed:', err)
    return { ok: false, error: 'Could not reorder chapters' }
  }
}

// ===========================================================
// LESSONS
// ===========================================================

export async function createLessonAction(
  courseId: string,
  chapterId: string,
  type: LessonType,
): Promise<CreateLessonResult> {
  await requireAdmin()

  const typeParsed = lessonTypeSchema.safeParse(type)
  if (!typeParsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(typeParsed.error) }
  }

  // Title is service-defaulted per type, so we validate the rest of
  // the create shape using the existing schema but compute the title
  // on the service side. Just sanity-check the chapter id here.
  const parsed = createLessonSchema
    .pick({ chapterId: true, type: true })
    .safeParse({ chapterId, type: typeParsed.data })
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) }
  }

  try {
    const lesson = await lessonService.create({
      chapterId: parsed.data.chapterId,
      type: parsed.data.type,
    })
    revalidatePath(`/admin/courses/${courseId}`)
    return { ok: true, lesson }
  } catch (err) {
    console.error('Lesson create failed:', err)
    return { ok: false, error: 'Could not add lesson' }
  }
}

export async function updateLessonAction(
  courseId: string,
  lessonId: string,
  input: { title?: string; orderIndex?: number },
): Promise<UpdateLessonResult> {
  await requireAdmin()

  // Only the fields supported by the inline rename / reorder flow are
  // accepted here; the rich lesson editor (Phase D/E) will own the
  // full updateLessonSchema with description / video / resource bits.
  const parsed = updateLessonSchema
    .pick({ title: true, orderIndex: true })
    .safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) }
  }

  try {
    const lesson = await lessonService.update(lessonId, parsed.data)
    revalidatePath(`/admin/courses/${courseId}`)
    return { ok: true, lesson }
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      return { ok: false, error: 'Lesson not found' }
    }
    console.error('Lesson update failed:', err)
    return { ok: false, error: 'Could not save lesson' }
  }
}

export async function deleteLessonAction(
  courseId: string,
  lessonId: string,
): Promise<BaseResult> {
  await requireAdmin()
  try {
    await lessonService.delete(lessonId)
    revalidatePath(`/admin/courses/${courseId}`)
    return { ok: true }
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      return { ok: false, error: 'Lesson not found' }
    }
    console.error('Lesson delete failed:', err)
    return { ok: false, error: 'Could not delete lesson' }
  }
}

export async function reorderLessonsAction(
  courseId: string,
  chapterId: string,
  orderedIds: string[],
): Promise<BaseResult> {
  await requireAdmin()

  const parsed = reorderLessonsSchema.safeParse({
    courseId,
    chapterId,
    orderedIds,
  })
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) }
  }

  try {
    await lessonService.reorder(
      parsed.data.chapterId,
      parsed.data.orderedIds,
    )
    revalidatePath(`/admin/courses/${courseId}`)
    return { ok: true }
  } catch (err) {
    console.error('Lesson reorder failed:', err)
    return { ok: false, error: 'Could not reorder lessons' }
  }
}

// ===========================================================
// BULK SAVE  (manual save from the builder)
// ===========================================================
//
// Replaces the per-op chapter/lesson actions above for the builder
// surface — those still exist so other entry points (e.g. scripted
// imports later) can use them, but the builder now batches all edits
// behind a single Save click.

const syncLessonInputSchema = z
  .object({
    id: z.uuid().optional(),
    tempId: z.string().min(1).optional(),
    title: z.string().min(1).max(200),
    type: lessonTypeSchema,
    orderIndex: z.number().int().min(0),
  })
  .refine((d) => Boolean(d.id) || Boolean(d.tempId), {
    message: 'Each lesson must carry id or tempId',
  })

const syncChapterInputSchema = z
  .object({
    id: z.uuid().optional(),
    tempId: z.string().min(1).optional(),
    title: z.string().min(1).max(200),
    orderIndex: z.number().int().min(0),
    lessons: z.array(syncLessonInputSchema),
  })
  .refine((d) => Boolean(d.id) || Boolean(d.tempId), {
    message: 'Each chapter must carry id or tempId',
  })

const syncStructureSchema = z.object({
  chapters: z.array(syncChapterInputSchema),
})

export interface SaveStructureResult extends BaseResult {
  mappings?: SyncResult
}

export async function saveCourseStructureAction(
  courseId: string,
  payload: { chapters: unknown },
): Promise<SaveStructureResult> {
  await requireAdmin()

  const parsed = syncStructureSchema.safeParse(payload)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) }
  }

  try {
    const mappings = await courseStructureService.sync(
      courseId,
      parsed.data.chapters,
    )
    revalidatePath(`/admin/courses/${courseId}`)
    return { ok: true, mappings }
  } catch (err) {
    console.error('Course structure save failed:', err)
    return { ok: false, error: 'Could not save changes' }
  }
}

'use server'

import { revalidatePath } from 'next/cache'
import { Prisma, type LessonStatus, type LessonType } from '@prisma/client'
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
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
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
    description: z.string().max(5000).optional().nullable(),
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

// ===========================================================
// RESOURCE UPLOADS  (2.13)
// ===========================================================
//
// Client uploads directly to the lesson-resources bucket via a
// signed upload URL — keeps large files off the Server Action body
// limit (10 MB) and mirrors the Mux direct-upload pattern.

const RESOURCE_BUCKET = 'lesson-resources'
const RESOURCE_MAX_BYTES = 50 * 1024 * 1024 // 50 MB
const RESOURCE_ALLOWED_MIMES = new Set<string>([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/json',
  'text/plain',
  'text/csv',
  'text/markdown',
  'image/png',
  'image/jpeg',
  'image/webp',
])

const prepareResourceUploadSchema = z.object({
  lessonId: z.uuid(),
  filename: z.string().min(1).max(200),
  size: z.number().int().positive().max(RESOURCE_MAX_BYTES),
  mimeType: z.string().min(1).max(150),
})

const commitResourceUploadSchema = z.object({
  lessonId: z.uuid(),
  path: z.string().min(1),
  filename: z.string().min(1).max(200),
  size: z.number().int().positive().max(RESOURCE_MAX_BYTES),
})

function sanitizeFilename(name: string): string {
  // Strip diacritics / unsafe chars; keep extension dot.
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 ? name.slice(dot) : ''
  const stem = (dot > 0 ? name.slice(0, dot) : name)
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 150)
  return `${stem || 'file'}${ext}`.slice(0, 200)
}

export interface PrepareResourceUploadResult extends BaseResult {
  signedUrl?: string
  token?: string
  path?: string
}

export async function prepareResourceUploadAction(
  input: unknown,
): Promise<PrepareResourceUploadResult> {
  await requireAdmin()

  const parsed = prepareResourceUploadSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) }
  }
  if (!RESOURCE_ALLOWED_MIMES.has(parsed.data.mimeType)) {
    return {
      ok: false,
      error: `Unsupported file type: ${parsed.data.mimeType}`,
    }
  }

  const { lessonId, filename } = parsed.data
  const safeName = sanitizeFilename(filename)
  const path = `${lessonId}/${safeName}`

  // Wipe any prior file in this lesson's folder so we don't keep stale
  // attachments around when the user replaces a resource.
  const supabase = createAdminClient()
  const { data: existing } = await supabase.storage
    .from(RESOURCE_BUCKET)
    .list(lessonId)
  if (existing && existing.length > 0) {
    await supabase.storage
      .from(RESOURCE_BUCKET)
      .remove(existing.map((f) => `${lessonId}/${f.name}`))
  }

  const { data, error } = await supabase.storage
    .from(RESOURCE_BUCKET)
    .createSignedUploadUrl(path)
  if (error || !data) {
    console.error('Signed upload URL creation failed:', error)
    return { ok: false, error: 'Could not start upload' }
  }

  return {
    ok: true,
    signedUrl: data.signedUrl,
    token: data.token,
    path: data.path,
  }
}

export interface CommitResourceUploadResult extends BaseResult {
  resourceUrl?: string
  resourceName?: string
  resourceSize?: number
}

export async function commitResourceUploadAction(
  courseId: string,
  input: unknown,
): Promise<CommitResourceUploadResult> {
  await requireAdmin()

  const parsed = commitResourceUploadSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) }
  }

  const { lessonId, path, filename, size } = parsed.data

  try {
    await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        resourceUrl: path,
        resourceName: filename,
        resourceSize: size,
        status: 'READY',
      },
    })
    revalidatePath(`/admin/courses/${courseId}`)
    return {
      ok: true,
      resourceUrl: path,
      resourceName: filename,
      resourceSize: size,
    }
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      return { ok: false, error: 'Lesson not found' }
    }
    console.error('Resource commit failed:', err)
    return { ok: false, error: 'Could not save resource' }
  }
}

// ===========================================================
// VIDEO PROCESSING STATUS  (2.17)
// ===========================================================

export interface LessonStatusResult extends BaseResult {
  lesson?: {
    id: string
    chapterId: string
    status: LessonStatus
    durationSeconds: number | null
    muxPlaybackId: string | null
  }
}

/**
 * Lightweight poll endpoint — returns just the fields that change
 * via the Mux webhook so the builder can tick until PROCESSING flips
 * to READY (or errors back to DRAFT). chapterId is included so the
 * client can update local state without a separate lookup.
 */
export async function getLessonStatusAction(
  lessonId: string,
): Promise<LessonStatusResult> {
  await requireAdmin()

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      chapterId: true,
      status: true,
      durationSeconds: true,
      muxPlaybackId: true,
    },
  })
  if (!lesson) return { ok: false, error: 'Lesson not found' }
  return { ok: true, lesson }
}

export interface ResourceDownloadUrlResult extends BaseResult {
  url?: string
}

const RESOURCE_DOWNLOAD_EXPIRY_SECONDS = 60

export async function getResourceDownloadUrlAction(
  lessonId: string,
): Promise<ResourceDownloadUrlResult> {
  await requireAdmin()

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { resourceUrl: true },
  })
  if (!lesson?.resourceUrl) {
    return { ok: false, error: 'No file attached to this lesson' }
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.storage
    .from(RESOURCE_BUCKET)
    .createSignedUrl(lesson.resourceUrl, RESOURCE_DOWNLOAD_EXPIRY_SECONDS)

  if (error || !data) {
    console.error('Signed download URL creation failed:', error)
    return { ok: false, error: 'Could not generate download link' }
  }
  return { ok: true, url: data.signedUrl }
}

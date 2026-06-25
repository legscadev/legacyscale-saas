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
  moduleService,
  type ModuleListItem,
} from '@/lib/services/module-service'
import {
  courseStructureService,
  type SyncResult,
} from '@/lib/services/course-structure-service'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  createChapterSchema,
  createLessonSchema,
  createModuleSchema,
  lessonTypeSchema,
  updateChapterSchema,
  updateLessonSchema,
  updateModuleSchema,
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

export interface CreateModuleResult extends BaseResult {
  module?: ModuleListItem
}

export interface UpdateModuleResult extends BaseResult {
  module?: ModuleListItem
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
    revalidatePath('/admin/courses/[slug]', 'page')
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
    revalidatePath('/admin/courses/[slug]', 'page')
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
  _courseId: string,
): Promise<BaseResult> {
  await requireAdmin()
  try {
    await chapterService.delete(chapterId)
    revalidatePath('/admin/courses/[slug]', 'page')
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
    revalidatePath('/admin/courses/[slug]', 'page')
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
    revalidatePath('/admin/courses/[slug]', 'page')
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
    revalidatePath('/admin/courses/[slug]', 'page')
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
    revalidatePath('/admin/courses/[slug]', 'page')
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
    revalidatePath('/admin/courses/[slug]', 'page')
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

// IDs are accepted as any non-empty string so seeded/imported rows
// with slug-like identifiers (e.g. "sample-chapter-1") sync the same
// way as UUID-generated rows. The DB does the actual lookup.
const syncLessonInputSchema = z
  .object({
    id: z.string().min(1).optional(),
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
    id: z.string().min(1).optional(),
    tempId: z.string().min(1).optional(),
    title: z.string().min(1).max(200),
    orderIndex: z.number().int().min(0),
    // Optional parent module: undefined = leave untouched in DB,
    // null = move to / create as loose chapter, UUID = module-bound.
    // Modules themselves are managed via /api/admin/modules/* —
    // this field only carries the chapter→module link.
    moduleId: z.string().uuid().nullable().optional(),
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
    // Log the issue so it shows up in Vercel logs — the toast on the
    // client only sees this generic message, not the field paths.
    console.error('Course structure validation failed:', parsed.error.issues)
    return {
      ok: false,
      error: 'Some chapter or lesson data looks invalid',
      fieldErrors: fieldErrorsFrom(parsed.error),
    }
  }

  try {
    const mappings = await courseStructureService.sync(
      courseId,
      parsed.data.chapters,
    )
    revalidatePath('/admin/courses/[slug]', 'page')
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
  resourceId: z.uuid(),
  path: z.string().min(1),
  filename: z.string().min(1).max(200),
  size: z.number().int().positive().max(RESOURCE_MAX_BYTES),
  mimeType: z.string().min(1).max(150),
})

export interface PrepareResourceUploadResult extends BaseResult {
  signedUrl?: string
  token?: string
  path?: string
  /** Server-minted id the client passes back to commit. */
  resourceId?: string
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

  const { lessonId } = parsed.data
  // Mint a resource id up front — it's both the row PK on commit and
  // the file path leaf, so the bucket file is addressable even if
  // commit fails (a sweep can still find the orphan).
  const resourceId = crypto.randomUUID()
  const path = `${lessonId}/${resourceId}`

  const supabase = createAdminClient()
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
    resourceId,
  }
}

export interface CommitResourceUploadResult extends BaseResult {
  resource?: {
    id: string
    lessonId: string
    name: string
    size: number
    mimeType: string
    createdAt: Date
  }
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

  const { lessonId, resourceId, path, filename, size, mimeType } = parsed.data

  try {
    const resource = await prisma.lessonResource.create({
      data: {
        id: resourceId,
        lessonId,
        name: filename,
        path,
        size,
        mimeType,
      },
      select: {
        id: true,
        lessonId: true,
        name: true,
        size: true,
        mimeType: true,
        createdAt: true,
      },
    })
    // Flip the lesson to READY on its first attachment; later
    // uploads against an already-READY lesson keep the same status.
    await prisma.lesson.update({
      where: { id: lessonId },
      data: { status: 'READY' },
    })
    revalidatePath('/admin/courses/[slug]', 'page')
    return { ok: true, resource }
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2003'
    ) {
      return { ok: false, error: 'Lesson not found' }
    }
    console.error('Resource commit failed:', err)
    return { ok: false, error: 'Could not save resource' }
  }
}

export async function removeLessonResourceAction(
  courseId: string,
  resourceId: string,
): Promise<BaseResult> {
  await requireAdmin()

  try {
    const resource = await prisma.lessonResource.findUnique({
      where: { id: resourceId },
      select: { id: true, path: true, lessonId: true },
    })
    if (!resource) return { ok: false, error: 'Resource not found' }

    // Best-effort bucket cleanup before the DB row goes — same
    // posture as Mux delete.
    const supabase = createAdminClient()
    const { error: removeErr } = await supabase.storage
      .from(RESOURCE_BUCKET)
      .remove([resource.path])
    if (removeErr) {
      console.error(
        `Resource bucket remove failed for ${resource.path}:`,
        removeErr,
      )
    }

    await prisma.lessonResource.delete({ where: { id: resourceId } })
    revalidatePath('/admin/courses/[slug]', 'page')
    return { ok: true }
  } catch (err) {
    console.error('Resource delete failed:', err)
    return { ok: false, error: 'Could not delete resource' }
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
  resourceId: string,
): Promise<ResourceDownloadUrlResult> {
  await requireAdmin()

  const resource = await prisma.lessonResource.findUnique({
    where: { id: resourceId },
    select: { path: true, name: true },
  })
  if (!resource) {
    return { ok: false, error: 'Resource not found' }
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.storage
    .from(RESOURCE_BUCKET)
    .createSignedUrl(resource.path, RESOURCE_DOWNLOAD_EXPIRY_SECONDS, {
      // Force Content-Disposition: attachment with the original name
      // so the browser downloads as e.g. "workbook.pdf" instead of
      // the opaque bucket path.
      download: resource.name,
    })

  if (error || !data) {
    console.error('Signed download URL creation failed:', error)
    return { ok: false, error: 'Could not generate download link' }
  }
  return { ok: true, url: data.signedUrl }
}

// ===========================================================
// MODULE CRUD  (Phase 3)
// ===========================================================
//
// Modules are an optional grouping layer between Course and Chapter.
// CRUD happens through these standalone actions — they do NOT flow
// through saveCourseStructureAction (chapters/lessons still do).
// That keeps the structure-sync transaction tight and lets module
// edits land independently of chapter saves.

export async function createModuleAction(
  courseId: string,
  input: { title?: string; description?: string } = {},
): Promise<CreateModuleResult> {
  await requireAdmin()

  const parsed = createModuleSchema.safeParse({
    courseId,
    title: input.title ?? 'New module',
    description: input.description,
  })
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) }
  }

  try {
    const moduleRow = await moduleService.create({
      courseId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
    })
    revalidatePath('/admin/courses/[slug]', 'page')
    return { ok: true, module: moduleRow }
  } catch (err) {
    console.error('Module create failed:', err)
    return { ok: false, error: 'Could not create module' }
  }
}

export async function updateModuleAction(
  moduleId: string,
  input: { title?: string; description?: string | null },
): Promise<UpdateModuleResult> {
  await requireAdmin()

  const parsed = updateModuleSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) }
  }

  try {
    const moduleRow = await moduleService.update(moduleId, parsed.data)
    revalidatePath('/admin/courses/[slug]', 'page')
    return { ok: true, module: moduleRow }
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      return { ok: false, error: 'Module not found' }
    }
    console.error('Module update failed:', err)
    return { ok: false, error: 'Could not update module' }
  }
}

export async function deleteModuleAction(
  moduleId: string,
): Promise<BaseResult> {
  await requireAdmin()

  // Look up the courseId before delete so we can revalidate even
  // though the row is about to disappear.
  const existing = await prisma.module.findUnique({
    where: { id: moduleId },
    select: { courseId: true },
  })
  if (!existing) return { ok: false, error: 'Module not found' }

  try {
    await moduleService.delete(moduleId)
    revalidatePath('/admin/courses/[slug]', 'page')
    return { ok: true }
  } catch (err) {
    console.error('Module delete failed:', err)
    return { ok: false, error: 'Could not delete module' }
  }
}

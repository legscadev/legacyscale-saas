'use server'

import { revalidatePath } from 'next/cache'
import type { CourseStatus } from '@prisma/client'

import { requireAdmin } from '@/lib/auth/get-user'
import {
  courseService,
  type CourseCounts,
  type CourseListItem,
  type CourseSortField,
  type CourseView,
  type SortDirection,
} from '@/lib/services/course-service'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  createCourseSchema,
  updateCourseSchema,
} from '@/lib/validations/course'

const THUMBNAIL_BUCKET = 'course-thumbnails'
const THUMBNAIL_MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const THUMBNAIL_MIMES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export interface CoursesQueryState {
  search: string
  status: CourseStatus | null
  view: CourseView
  sort: CourseSortField
  direction: SortDirection
  page: number
}

export interface CoursesData {
  counts: CourseCounts
  items: CourseListItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export async function fetchCourses(
  state: CoursesQueryState,
): Promise<CoursesData> {
  await requireAdmin()

  const [counts, result] = await Promise.all([
    courseService.counts(),
    courseService.list({
      search: state.search || undefined,
      status: state.status,
      view: state.view,
      sort: state.sort,
      direction: state.direction,
      page: state.page,
      limit: courseService.defaultPageSize,
    }),
  ])

  return {
    counts,
    items: result.items,
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  }
}

// ===========================================================
// CREATE
// ===========================================================

export interface CreateCourseResult {
  ok: boolean
  id?: string
  error?: string
  fieldErrors?: Record<string, string[]>
}

/**
 * Single-roundtrip create flow: validates → creates the course row →
 * (optionally) uploads thumbnail and patches the URL.
 *
 * If the thumbnail upload fails after the row is created, we keep the
 * course (admin can re-upload from the edit screen) and surface a
 * warning toast via `error`.
 */
export async function createCourseAction(
  formData: FormData,
): Promise<CreateCourseResult> {
  const admin = await requireAdmin()

  // Pull primitives off the FormData and re-shape into the schema input.
  const accessDaysRaw = formData.get('accessDays')
  const accessDays =
    accessDaysRaw === null || accessDaysRaw === ''
      ? null
      : Number(accessDaysRaw)

  const parsed = createCourseSchema.safeParse({
    title: formData.get('title') ?? '',
    description: (formData.get('description') as string) || undefined,
    status: (formData.get('status') as string) || 'DRAFT',
    accessDays,
    // thumbnailUrl is set in step 2 after upload — never trusted off the form.
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.')
      if (!fieldErrors[key]) fieldErrors[key] = []
      fieldErrors[key]!.push(issue.message)
    }
    return { ok: false, fieldErrors }
  }

  // Validate the optional thumbnail before we touch the DB so a bad
  // file fails the request cleanly with no orphan row.
  const file = formData.get('thumbnail')
  const thumbnailFile =
    file instanceof File && file.size > 0 ? file : null

  if (thumbnailFile) {
    if (!THUMBNAIL_MIMES[thumbnailFile.type]) {
      return {
        ok: false,
        fieldErrors: { thumbnail: ['Thumbnail must be a PNG, JPEG, or WebP image'] },
      }
    }
    if (thumbnailFile.size > THUMBNAIL_MAX_BYTES) {
      return {
        ok: false,
        fieldErrors: { thumbnail: ['Thumbnail must be 5 MB or smaller'] },
      }
    }
  }

  // 1. Create the row.
  const course = await courseService.create(parsed.data, admin.id)

  // 2. Upload + patch thumbnail (best-effort — row already exists).
  if (thumbnailFile) {
    try {
      const url = await uploadThumbnail(course.id, thumbnailFile)
      await courseService.update(course.id, { thumbnailUrl: url })
    } catch (err) {
      console.error('Thumbnail upload failed:', err)
      revalidatePath('/admin/courses')
      return {
        ok: true,
        id: course.id,
        error:
          'Course created, but the thumbnail upload failed. You can retry from the edit screen.',
      }
    }
  }

  revalidatePath('/admin/courses')
  return { ok: true, id: course.id }
}

// ===========================================================
// UPDATE
// ===========================================================

export interface UpdateCourseResult {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

export async function updateCourseAction(
  courseId: string,
  formData: FormData,
): Promise<UpdateCourseResult> {
  await requireAdmin()

  // Only forward fields the form actually sent. Partial saves (e.g.
  // the builder sidebar's debounced description-only update) must not
  // get tripped up by validation on a field they aren't touching.
  const input: Record<string, unknown> = {}
  if (formData.has('title')) input.title = formData.get('title')
  if (formData.has('description')) {
    input.description = (formData.get('description') as string) || undefined
  }
  if (formData.has('status')) input.status = formData.get('status')
  if (formData.has('accessDays')) {
    const raw = formData.get('accessDays')
    input.accessDays = raw === null || raw === '' ? null : Number(raw)
  }

  const parsed = updateCourseSchema.safeParse(input)

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.')
      if (!fieldErrors[key]) fieldErrors[key] = []
      fieldErrors[key]!.push(issue.message)
    }
    return { ok: false, fieldErrors }
  }

  const file = formData.get('thumbnail')
  const thumbnailFile = file instanceof File && file.size > 0 ? file : null
  const clearThumbnail = formData.get('clearThumbnail') === '1'

  if (thumbnailFile) {
    if (!THUMBNAIL_MIMES[thumbnailFile.type]) {
      return {
        ok: false,
        fieldErrors: { thumbnail: ['Thumbnail must be a PNG, JPEG, or WebP image'] },
      }
    }
    if (thumbnailFile.size > THUMBNAIL_MAX_BYTES) {
      return {
        ok: false,
        fieldErrors: { thumbnail: ['Thumbnail must be 5 MB or smaller'] },
      }
    }
  }

  // Apply primitive updates first.
  try {
    await courseService.update(courseId, parsed.data)
  } catch (err) {
    console.error('Course update failed:', err)
    return { ok: false, error: 'Could not update course' }
  }

  // Then handle the thumbnail side-effects.
  if (thumbnailFile) {
    try {
      const url = await uploadThumbnail(courseId, thumbnailFile)
      await courseService.update(courseId, { thumbnailUrl: url })
    } catch (err) {
      console.error('Thumbnail upload failed:', err)
      revalidatePath('/admin/courses')
      revalidatePath(`/admin/courses/${courseId}`)
      return {
        ok: true,
        error: 'Course updated, but the thumbnail upload failed.',
      }
    }
  } else if (clearThumbnail) {
    try {
      await deleteThumbnailFolder(courseId)
      await courseService.update(courseId, { thumbnailUrl: '' })
    } catch (err) {
      console.error('Thumbnail delete failed:', err)
    }
  }

  revalidatePath('/admin/courses')
  revalidatePath(`/admin/courses/${courseId}`)
  return { ok: true }
}

// ===========================================================
// DELETE / RESTORE
// ===========================================================

export interface SimpleResult {
  ok: boolean
  error?: string
}

export async function softDeleteCourseAction(
  courseId: string,
): Promise<SimpleResult> {
  await requireAdmin()
  try {
    await courseService.softDelete(courseId)
    revalidatePath('/admin/courses')
    return { ok: true }
  } catch (err) {
    console.error('Course soft-delete failed:', err)
    return { ok: false, error: 'Could not delete course' }
  }
}

// ===========================================================
// STORAGE
// ===========================================================

async function uploadThumbnail(courseId: string, file: File): Promise<string> {
  const ext = THUMBNAIL_MIMES[file.type]
  if (!ext) throw new Error('Unsupported mime type')

  const supabase = createAdminClient()
  const folder = courseId
  const path = `${folder}/thumbnail.${ext}`

  // Remove stale files so changing format (jpg → png) doesn't leave
  // both lying around.
  const { data: existing } = await supabase.storage
    .from(THUMBNAIL_BUCKET)
    .list(folder)
  if (existing && existing.length > 0) {
    await supabase.storage
      .from(THUMBNAIL_BUCKET)
      .remove(existing.map((f) => `${folder}/${f.name}`))
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const { error } = await supabase.storage
    .from(THUMBNAIL_BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    })
  if (error) throw error

  const { data } = supabase.storage.from(THUMBNAIL_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

async function deleteThumbnailFolder(courseId: string): Promise<void> {
  const supabase = createAdminClient()
  const { data: existing } = await supabase.storage
    .from(THUMBNAIL_BUCKET)
    .list(courseId)
  if (!existing || existing.length === 0) return
  await supabase.storage
    .from(THUMBNAIL_BUCKET)
    .remove(existing.map((f) => `${courseId}/${f.name}`))
}

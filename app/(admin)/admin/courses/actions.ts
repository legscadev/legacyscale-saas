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
const THUMBNAIL_MAX_BYTES = 10 * 1024 * 1024 // 10 MB
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
    isFree: formData.get('isFree') === '1',
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

  // Validate the optional images before we touch the DB so a bad
  // file fails the request cleanly with no orphan row.
  const thumbnailFile = readUploadedFile(formData, 'thumbnail')
  const coverFile = readUploadedFile(formData, 'coverImage')

  const thumbnailErr = validateImageFile(thumbnailFile, 'Thumbnail')
  if (thumbnailErr) return { ok: false, fieldErrors: { thumbnail: [thumbnailErr] } }
  const coverErr = validateImageFile(coverFile, 'Cover image')
  if (coverErr) return { ok: false, fieldErrors: { coverImage: [coverErr] } }

  // 1. Create the row.
  const course = await courseService.create(parsed.data, admin.id)

  // 2. Upload + patch images (best-effort — row already exists).
  const imagePatch: { thumbnailUrl?: string; coverImageUrl?: string } = {}
  const warnings: string[] = []
  if (thumbnailFile) {
    try {
      imagePatch.thumbnailUrl = await uploadThumbnail(course.id, thumbnailFile)
    } catch (err) {
      console.error('Thumbnail upload failed:', err)
      warnings.push('thumbnail upload failed')
    }
  }
  if (coverFile) {
    try {
      imagePatch.coverImageUrl = await uploadCoverImage(course.id, coverFile)
    } catch (err) {
      console.error('Cover image upload failed:', err)
      warnings.push('cover image upload failed')
    }
  }
  if (Object.keys(imagePatch).length > 0) {
    await courseService.update(course.id, imagePatch)
  }

  revalidatePath('/admin/courses')
  if (warnings.length > 0) {
    return {
      ok: true,
      id: course.id,
      error: `Course created, but ${warnings.join(' and ')}. You can retry from the edit screen.`,
    }
  }
  return { ok: true, id: course.id }
}

// Tiny helpers to keep the create/update bodies readable now that
// there are two image slots.
function readUploadedFile(formData: FormData, key: string): File | null {
  const v = formData.get(key)
  return v instanceof File && v.size > 0 ? v : null
}

function validateImageFile(
  file: File | null,
  label: 'Thumbnail' | 'Cover image',
): string | null {
  if (!file) return null
  if (!THUMBNAIL_MIMES[file.type]) {
    return `${label} must be a PNG, JPEG, or WebP image`
  }
  if (file.size > THUMBNAIL_MAX_BYTES) {
    return `${label} must be 10 MB or smaller`
  }
  return null
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
  if (formData.has('isFree')) {
    input.isFree = formData.get('isFree') === '1'
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

  const thumbnailFile = readUploadedFile(formData, 'thumbnail')
  const coverFile = readUploadedFile(formData, 'coverImage')
  const clearThumbnail = formData.get('clearThumbnail') === '1'
  const clearCoverImage = formData.get('clearCoverImage') === '1'

  const thumbnailErr = validateImageFile(thumbnailFile, 'Thumbnail')
  if (thumbnailErr) return { ok: false, fieldErrors: { thumbnail: [thumbnailErr] } }
  const coverErr = validateImageFile(coverFile, 'Cover image')
  if (coverErr) return { ok: false, fieldErrors: { coverImage: [coverErr] } }

  // Apply primitive updates first.
  try {
    await courseService.update(courseId, parsed.data)
  } catch (err) {
    console.error('Course update failed:', err)
    return { ok: false, error: 'Could not update course' }
  }

  // Then handle the image side-effects.
  const warnings: string[] = []

  if (thumbnailFile) {
    try {
      const url = await uploadThumbnail(courseId, thumbnailFile)
      await courseService.update(courseId, { thumbnailUrl: url })
    } catch (err) {
      console.error('Thumbnail upload failed:', err)
      warnings.push('thumbnail upload failed')
    }
  } else if (clearThumbnail) {
    try {
      await deleteCourseImage(courseId, 'thumbnail')
      await courseService.update(courseId, { thumbnailUrl: '' })
    } catch (err) {
      console.error('Thumbnail delete failed:', err)
    }
  }

  if (coverFile) {
    try {
      const url = await uploadCoverImage(courseId, coverFile)
      await courseService.update(courseId, { coverImageUrl: url })
    } catch (err) {
      console.error('Cover image upload failed:', err)
      warnings.push('cover image upload failed')
    }
  } else if (clearCoverImage) {
    try {
      await deleteCourseImage(courseId, 'cover')
      await courseService.update(courseId, { coverImageUrl: '' })
    } catch (err) {
      console.error('Cover image delete failed:', err)
    }
  }

  revalidatePath('/admin/courses')
  revalidatePath(`/admin/courses/${courseId}`)

  if (warnings.length > 0) {
    return {
      ok: true,
      error: `Course updated, but ${warnings.join(' and ')}.`,
    }
  }
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

type CourseImageKind = 'thumbnail' | 'cover'

async function uploadCourseImage(
  courseId: string,
  file: File,
  kind: CourseImageKind,
): Promise<string> {
  const ext = THUMBNAIL_MIMES[file.type]
  if (!ext) throw new Error('Unsupported mime type')

  const supabase = createAdminClient()
  const folder = courseId
  const path = `${folder}/${kind}.${ext}`

  // Remove stale files for THIS kind only (so changing format
  // jpg → png doesn't leave both lying around, but the other kind's
  // file stays intact).
  const { data: existing } = await supabase.storage
    .from(THUMBNAIL_BUCKET)
    .list(folder)
  const stalePaths = (existing ?? [])
    .filter((f) => f.name.startsWith(`${kind}.`))
    .map((f) => `${folder}/${f.name}`)
  if (stalePaths.length > 0) {
    await supabase.storage.from(THUMBNAIL_BUCKET).remove(stalePaths)
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

// Kept as a thin alias so existing call sites stay readable.
async function uploadThumbnail(courseId: string, file: File): Promise<string> {
  return uploadCourseImage(courseId, file, 'thumbnail')
}

async function uploadCoverImage(
  courseId: string,
  file: File,
): Promise<string> {
  return uploadCourseImage(courseId, file, 'cover')
}

async function deleteCourseImage(
  courseId: string,
  kind: CourseImageKind,
): Promise<void> {
  const supabase = createAdminClient()
  const { data: existing } = await supabase.storage
    .from(THUMBNAIL_BUCKET)
    .list(courseId)
  const paths = (existing ?? [])
    .filter((f) => f.name.startsWith(`${kind}.`))
    .map((f) => `${courseId}/${f.name}`)
  if (paths.length === 0) return
  await supabase.storage.from(THUMBNAIL_BUCKET).remove(paths)
}

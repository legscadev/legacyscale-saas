'use server'

import { revalidatePath } from 'next/cache'
import type { CourseStatus } from '@prisma/client'
import { z } from 'zod'

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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type CourseImageKind = 'thumbnail' | 'cover'

function imagePathFor(
  courseId: string,
  kind: CourseImageKind,
  ext: string,
): string {
  return `${courseId}/${kind}.${ext}`
}

// Verifies that a client-supplied path matches a course we minted a
// signed URL for. Reject anything that doesn't look like one of our
// own paths so an admin can't set course A's thumbnail to a file
// living in course B's folder.
function parseCourseImagePath(
  path: string,
  courseId: string,
): CourseImageKind | null {
  const prefix = `${courseId}/`
  if (!path.startsWith(prefix)) return null
  const leaf = path.slice(prefix.length)
  const m = /^(thumbnail|cover)\.(png|jpg|webp)$/.exec(leaf)
  return m ? (m[1] as CourseImageKind) : null
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
// PREPARE IMAGE UPLOAD (signed URL)
// ===========================================================

// Browser uploads thumbnails/covers directly to Supabase Storage via
// a signed URL. Routing the file through a Server Action would hit
// Vercel's ~4.5 MB body cap on the function gateway (smaller than
// our app-level 10 MB cap), and the client would just see a generic
// "Network error" when the request died at the edge.

const prepareCourseImageUploadSchema = z.object({
  courseId: z.string().regex(UUID_RE, 'courseId must be a UUID'),
  kind: z.enum(['thumbnail', 'cover']),
  filename: z.string().min(1).max(200),
  size: z.number().int().positive().max(THUMBNAIL_MAX_BYTES),
  mimeType: z.string().min(1).max(150),
})

export interface PrepareCourseImageUploadResult {
  ok: boolean
  signedUrl?: string
  token?: string
  path?: string
  error?: string
  fieldErrors?: Record<string, string[]>
}

export async function prepareCourseImageUploadAction(
  input: unknown,
): Promise<PrepareCourseImageUploadResult> {
  await requireAdmin()

  const parsed = prepareCourseImageUploadSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.')
      if (!fieldErrors[key]) fieldErrors[key] = []
      fieldErrors[key]!.push(issue.message)
    }
    return { ok: false, fieldErrors }
  }
  const ext = THUMBNAIL_MIMES[parsed.data.mimeType]
  if (!ext) {
    return {
      ok: false,
      error: `${parsed.data.kind === 'thumbnail' ? 'Thumbnail' : 'Cover image'} must be a PNG, JPEG, or WebP image`,
    }
  }

  const { courseId, kind } = parsed.data
  const path = imagePathFor(courseId, kind, ext)

  const supabase = createAdminClient()
  // upsert: true so an admin replacing the same-extension image
  // overwrites the existing object cleanly. Different-extension
  // replacements still need an explicit cleanup pass; the commit
  // step (create/update action below) handles those orphans.
  const { data, error } = await supabase.storage
    .from(THUMBNAIL_BUCKET)
    .createSignedUploadUrl(path, { upsert: true })
  if (error || !data) {
    console.error('Course image signed URL creation failed:', error)
    return { ok: false, error: 'Could not start upload' }
  }

  return {
    ok: true,
    signedUrl: data.signedUrl,
    token: data.token,
    path: data.path,
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
 * Single-roundtrip create flow: validates → creates the course row
 * with the (already-uploaded) thumbnail/cover paths resolved to
 * public URLs.
 *
 * Images are uploaded browser → Supabase Storage via signed URL
 * BEFORE the form is submitted (see prepareCourseImageUploadAction).
 * The client mints a UUID up front so it can prepare an upload
 * keyed on the eventual course id; that same UUID becomes the
 * course row's primary key here.
 */
export async function createCourseAction(
  formData: FormData,
): Promise<CreateCourseResult> {
  const admin = await requireAdmin()

  const courseId = formData.get('courseId')
  if (typeof courseId !== 'string' || !UUID_RE.test(courseId)) {
    return { ok: false, error: 'Missing or invalid course id' }
  }

  // Pull primitives off the FormData and re-shape into the schema input.
  const accessDaysRaw = formData.get('accessDays')
  const accessDays =
    accessDaysRaw === null || accessDaysRaw === ''
      ? null
      : Number(accessDaysRaw)

  // Resolve any uploaded paths into public URLs so the row carries
  // a stable display URL like before.
  const imageResolve = resolveImagePaths(formData, courseId)
  if (!imageResolve.ok) return imageResolve.error

  const parsed = createCourseSchema.safeParse({
    title: formData.get('title') ?? '',
    description: (formData.get('description') as string) || undefined,
    status: (formData.get('status') as string) || 'DRAFT',
    accessDays,
    isFree: formData.get('isFree') === '1',
    audience: (formData.get('audience') as string) || 'MEMBERS',
    thumbnailUrl: imageResolve.thumbnailUrl,
    coverImageUrl: imageResolve.coverImageUrl,
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

  const course = await courseService.create(parsed.data, admin.id, {
    id: courseId,
  })

  // Best-effort: sweep any stale image objects left over from a
  // different extension (e.g. the admin replaced jpg with png mid-flow).
  await cleanupStaleImages(courseId, imageResolve.usedPaths)

  revalidatePath('/admin/courses')
  return { ok: true, id: course.id }
}

// Tiny helpers to keep the create/update bodies readable now that
// there are two image slots.

interface ResolveImagePathsOk {
  ok: true
  thumbnailUrl: string | undefined
  coverImageUrl: string | undefined
  /** Paths the client claimed to have uploaded. Used by the post-write
   *  sweep to delete stale objects from a different extension. */
  usedPaths: Partial<Record<CourseImageKind, string>>
}

interface ResolveImagePathsErr {
  ok: false
  error: { ok: false; fieldErrors: Record<string, string[]> }
}

function resolveImagePaths(
  formData: FormData,
  courseId: string,
): ResolveImagePathsOk | ResolveImagePathsErr {
  const supabase = createAdminClient()
  const out: ResolveImagePathsOk = {
    ok: true,
    thumbnailUrl: undefined,
    coverImageUrl: undefined,
    usedPaths: {},
  }

  for (const [fieldKey, kind] of [
    ['thumbnailPath', 'thumbnail'],
    ['coverImagePath', 'cover'],
  ] as const) {
    const raw = formData.get(fieldKey)
    if (typeof raw !== 'string' || raw.length === 0) continue
    const parsedKind = parseCourseImagePath(raw, courseId)
    if (parsedKind !== kind) {
      return {
        ok: false,
        error: {
          ok: false,
          fieldErrors: {
            [kind === 'thumbnail' ? 'thumbnail' : 'coverImage']: [
              'Invalid upload reference',
            ],
          },
        },
      }
    }
    const { data } = supabase.storage
      .from(THUMBNAIL_BUCKET)
      .getPublicUrl(raw)
    if (kind === 'thumbnail') out.thumbnailUrl = data.publicUrl
    else out.coverImageUrl = data.publicUrl
    out.usedPaths[kind] = raw
  }

  return out
}

// Removes any `${kind}.*` objects in the course folder that aren't
// the one we just committed. Covers the jpg→png case where the new
// upload lives at a different leaf than the existing object.
async function cleanupStaleImages(
  courseId: string,
  usedPaths: Partial<Record<CourseImageKind, string>>,
): Promise<void> {
  const keepPaths = new Set(Object.values(usedPaths))
  if (keepPaths.size === 0) return
  const supabase = createAdminClient()
  const { data: existing } = await supabase.storage
    .from(THUMBNAIL_BUCKET)
    .list(courseId)
  const toRemove = (existing ?? [])
    .map((f) => `${courseId}/${f.name}`)
    .filter((p) => {
      const m = /\/(thumbnail|cover)\.(?:png|jpg|webp)$/.exec(p)
      if (!m) return false
      return usedPaths[m[1] as CourseImageKind] !== undefined && !keepPaths.has(p)
    })
  if (toRemove.length === 0) return
  try {
    await supabase.storage.from(THUMBNAIL_BUCKET).remove(toRemove)
  } catch (err) {
    console.error('Stale course image sweep failed:', err)
  }
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
  if (formData.has('audience')) {
    input.audience = formData.get('audience')
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

  const clearThumbnail = formData.get('clearThumbnail') === '1'
  const clearCoverImage = formData.get('clearCoverImage') === '1'

  const imageResolve = resolveImagePaths(formData, courseId)
  if (!imageResolve.ok) return imageResolve.error

  // Fold the resolved image URLs / clears into the primitive update.
  const update: Record<string, unknown> = { ...parsed.data }
  if (imageResolve.thumbnailUrl !== undefined) {
    update.thumbnailUrl = imageResolve.thumbnailUrl
  } else if (clearThumbnail) {
    update.thumbnailUrl = ''
  }
  if (imageResolve.coverImageUrl !== undefined) {
    update.coverImageUrl = imageResolve.coverImageUrl
  } else if (clearCoverImage) {
    update.coverImageUrl = ''
  }

  try {
    await courseService.update(courseId, update)
  } catch (err) {
    console.error('Course update failed:', err)
    return { ok: false, error: 'Could not update course' }
  }

  // Best-effort housekeeping — never blocks the success response.
  await cleanupStaleImages(courseId, imageResolve.usedPaths)
  if (clearThumbnail && imageResolve.thumbnailUrl === undefined) {
    try {
      await deleteCourseImage(courseId, 'thumbnail')
    } catch (err) {
      console.error('Thumbnail delete failed:', err)
    }
  }
  if (clearCoverImage && imageResolve.coverImageUrl === undefined) {
    try {
      await deleteCourseImage(courseId, 'cover')
    } catch (err) {
      console.error('Cover image delete failed:', err)
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

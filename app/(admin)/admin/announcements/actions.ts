'use server'

import { revalidatePath } from 'next/cache'
import type { AnnouncementStatus } from '@prisma/client'

import { requireAdmin } from '@/lib/auth/get-user'
import {
  announcementService,
  type AnnouncementCounts,
  type AnnouncementListItem,
  type AnnouncementView,
} from '@/lib/services/announcement-service'
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
} from '@/lib/validations/announcement'

export interface AnnouncementsQueryState {
  search: string
  status: AnnouncementStatus | null
  view: AnnouncementView
  page: number
}

export interface AnnouncementsData {
  counts: AnnouncementCounts
  items: AnnouncementListItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export async function fetchAnnouncements(
  state: AnnouncementsQueryState,
): Promise<AnnouncementsData> {
  await requireAdmin()

  const [counts, result] = await Promise.all([
    announcementService.counts(),
    announcementService.list({
      search: state.search || undefined,
      status: state.status,
      view: state.view,
      page: state.page,
      limit: announcementService.defaultPageSize,
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

export interface CreateAnnouncementResult {
  ok: boolean
  id?: string
  error?: string
  fieldErrors?: Record<string, string[]>
}

export async function createAnnouncementAction(
  formData: FormData,
): Promise<CreateAnnouncementResult> {
  await requireAdmin()

  const parsed = createAnnouncementSchema.safeParse({
    title: formData.get('title') ?? '',
    body: (formData.get('body') as string) ?? '',
    status: (formData.get('status') as string) || 'DRAFT',
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

  try {
    const announcement = await announcementService.create(parsed.data)
    revalidatePath('/admin/announcements')
    return { ok: true, id: announcement.id }
  } catch (err) {
    console.error('Announcement create failed:', err)
    return { ok: false, error: 'Could not create announcement' }
  }
}

// ===========================================================
// UPDATE
// ===========================================================

export interface UpdateAnnouncementResult {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

export async function updateAnnouncementAction(
  announcementId: string,
  formData: FormData,
): Promise<UpdateAnnouncementResult> {
  await requireAdmin()

  // Only forward fields the form actually sent so partial saves don't
  // get tripped up by validation on untouched fields.
  const input: Record<string, unknown> = {}
  if (formData.has('title')) input.title = formData.get('title')
  if (formData.has('body')) input.body = formData.get('body')
  if (formData.has('status')) input.status = formData.get('status')

  const parsed = updateAnnouncementSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.')
      if (!fieldErrors[key]) fieldErrors[key] = []
      fieldErrors[key]!.push(issue.message)
    }
    return { ok: false, fieldErrors }
  }

  try {
    const updated = await announcementService.update(announcementId, parsed.data)
    if (!updated) {
      return { ok: false, error: 'Announcement not found' }
    }
    revalidatePath('/admin/announcements')
    revalidatePath(`/admin/announcements/${announcementId}/edit`)
    return { ok: true }
  } catch (err) {
    console.error('Announcement update failed:', err)
    return { ok: false, error: 'Could not update announcement' }
  }
}

// ===========================================================
// DELETE
// ===========================================================

export interface SimpleResult {
  ok: boolean
  error?: string
}

export async function softDeleteAnnouncementAction(
  announcementId: string,
): Promise<SimpleResult> {
  await requireAdmin()
  try {
    await announcementService.softDelete(announcementId)
    revalidatePath('/admin/announcements')
    return { ok: true }
  } catch (err) {
    console.error('Announcement soft-delete failed:', err)
    return { ok: false, error: 'Could not delete announcement' }
  }
}

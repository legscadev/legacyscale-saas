'use server'

import { revalidatePath, updateTag } from 'next/cache'
import type { AnnouncementStatus } from '@prisma/client'

import { requireAdmin } from '@/lib/auth/get-user'
import {
  announcementService,
  UNREAD_COUNT_CACHE_TAG,
  type AnnouncementCounts,
  type AnnouncementListItem,
  type AnnouncementReader,
  type AnnouncementView,
} from '@/lib/services/announcement-service'
import {
  BODY_TEXT_MAX,
  createAnnouncementSchema,
  updateAnnouncementSchema,
} from '@/lib/validations/announcement'
import { htmlToPlainText } from '@/lib/utils'
import { prisma } from '@/lib/prisma'
import { sendAnnouncementEmail } from '@/lib/resend'
import { postAnnouncementToDiscord } from '@/lib/discord'

function buildAnnouncementUrl(id: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return `${base}/announcements/${id}`
}

// Best-effort Discord crosspost. Always swallows errors so a webhook
// hiccup never breaks the underlying create / update.
async function discordCrossPost(
  announcement: { id: string; title: string; body: string },
  mentionEveryone: boolean,
) {
  try {
    await postAnnouncementToDiscord({
      title: announcement.title,
      bodyPreview: htmlToPlainText(announcement.body),
      viewUrl: buildAnnouncementUrl(announcement.id),
      mentionEveryone,
    })
  } catch (err) {
    console.error('Discord crosspost failed:', err)
  }
}

// Best-effort email blast to every active member. Called only on
// FIRST publish (create with status=PUBLISHED, or edit transition
// DRAFT → PUBLISHED) and only when the admin opted in via the
// "Send email blast" checkbox.
//
// The Resend template is plain-text — we strip the TipTap HTML
// before sending so the email doesn't show literal markup. Errors
// are logged but never bubble up so a Resend hiccup can't fail the
// underlying create / update action.
async function blastAnnouncementEmail(announcement: {
  id: string
  title: string
  body: string
}) {
  try {
    const members = await prisma.user.findMany({
      where: { role: 'MEMBER', isActive: true, deletedAt: null },
      select: { email: true },
    })
    const recipients = members.map((m) => m.email)
    if (recipients.length === 0) return
    await sendAnnouncementEmail(
      recipients,
      announcement.title,
      htmlToPlainText(announcement.body),
      buildAnnouncementUrl(announcement.id),
    )
  } catch (err) {
    console.error('Announcement email blast failed:', err)
  }
}

// Wipe the per-page caches the announcements feed lives in. Called
// after any write that could change what shows up there or change
// the Bell badge.
function revalidateAnnouncements(announcementId?: string) {
  revalidatePath('/admin/announcements')
  revalidatePath('/announcements')
  if (announcementId) {
    revalidatePath(`/admin/announcements/${announcementId}/edit`)
    revalidatePath(`/announcements/${announcementId}`)
  }
  updateTag(UNREAD_COUNT_CACHE_TAG)
}

// Visible-text length cap applied AFTER HTML strip so a bulky
// formatted message doesn't trip the byte-level cap in zod.
function validateBodyLength(
  body: unknown,
): { ok: true } | { fieldErrors: Record<string, string[]> } {
  if (typeof body !== 'string') return { ok: true }
  if (htmlToPlainText(body).length > BODY_TEXT_MAX) {
    return {
      fieldErrors: {
        body: [`Body is too long (${BODY_TEXT_MAX} character limit)`],
      },
    }
  }
  return { ok: true }
}

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
  const admin = await requireAdmin()

  const rawBody = (formData.get('body') as string) ?? ''
  const bodyCheck = validateBodyLength(rawBody)
  if ('fieldErrors' in bodyCheck) return { ok: false, fieldErrors: bodyCheck.fieldErrors }

  const parsed = createAnnouncementSchema.safeParse({
    title: formData.get('title') ?? '',
    body: rawBody,
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

  const notifyEmail = formData.get('notifyEmail') === '1'
  const notifyDiscord = formData.get('notifyDiscord') === '1'
  const mentionEveryone = formData.get('discordMentionEveryone') === '1'

  try {
    const announcement = await announcementService.create(parsed.data, admin.id)
    // The author counts as having "read" what they wrote — keeps
    // their own Bell badge from lighting up on a fresh publish.
    if (announcement.status === 'PUBLISHED') {
      await announcementService.markAsRead(admin.id, [announcement.id])
      if (notifyEmail) await blastAnnouncementEmail(announcement)
      if (notifyDiscord) {
        await discordCrossPost(announcement, mentionEveryone)
      }
    }
    revalidateAnnouncements(announcement.id)
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
  const admin = await requireAdmin()

  // Only forward fields the form actually sent so partial saves don't
  // get tripped up by validation on untouched fields.
  const input: Record<string, unknown> = {}
  if (formData.has('title')) input.title = formData.get('title')
  if (formData.has('body')) input.body = formData.get('body')
  if (formData.has('status')) input.status = formData.get('status')

  if (typeof input.body === 'string') {
    const bodyCheck = validateBodyLength(input.body)
    if ('fieldErrors' in bodyCheck) return { ok: false, fieldErrors: bodyCheck.fieldErrors }
  }

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

  const notifyEmail = formData.get('notifyEmail') === '1'
  const notifyDiscord = formData.get('notifyDiscord') === '1'
  const mentionEveryone = formData.get('discordMentionEveryone') === '1'

  try {
    // Check the prior publish state BEFORE the update so we can
    // tell if this edit is the FIRST publish — that's the only
    // transition that should fire broadcast side-effects.
    const before = await announcementService.getById(announcementId)
    const wasPublishedBefore = !!before?.publishedAt

    const updated = await announcementService.update(announcementId, parsed.data)
    if (!updated) {
      return { ok: false, error: 'Announcement not found' }
    }
    // Author counts as having "read" the row they just published,
    // including the first DRAFT → PUBLISHED transition on edit.
    if (updated.status === 'PUBLISHED') {
      await announcementService.markAsRead(admin.id, [announcementId])
      const payload = {
        id: updated.id,
        title: updated.title,
        body: updated.body,
      }
      if (notifyEmail && !wasPublishedBefore) {
        await blastAnnouncementEmail(payload)
      }
      if (notifyDiscord && !wasPublishedBefore) {
        await discordCrossPost(payload, mentionEveryone)
      }
    }
    revalidateAnnouncements(announcementId)
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
    revalidateAnnouncements(announcementId)
    return { ok: true }
  } catch (err) {
    console.error('Announcement soft-delete failed:', err)
    return { ok: false, error: 'Could not delete announcement' }
  }
}

// Powers the 5-second "Undo" toast on the admin list. Restores a
// freshly soft-deleted row by clearing deletedAt.
export async function restoreAnnouncementAction(
  announcementId: string,
): Promise<SimpleResult> {
  await requireAdmin()
  try {
    await announcementService.restore(announcementId)
    revalidateAnnouncements(announcementId)
    return { ok: true }
  } catch (err) {
    console.error('Announcement restore failed:', err)
    return { ok: false, error: 'Could not restore announcement' }
  }
}

// Loader for the reads drill-down modal. Returns each user who has
// opened the announcement plus their role + readAt timestamp.
export async function getAnnouncementReadersAction(
  announcementId: string,
): Promise<{ ok: true; readers: AnnouncementReader[] } | { ok: false; error: string }> {
  await requireAdmin()
  try {
    const readers = await announcementService.getReaders(announcementId)
    return { ok: true, readers }
  } catch (err) {
    console.error('getReaders failed:', err)
    return { ok: false, error: 'Could not load readers' }
  }
}

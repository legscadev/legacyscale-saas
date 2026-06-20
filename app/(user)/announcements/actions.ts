'use server'

import { revalidatePath } from 'next/cache'

import { requireActiveUser } from '@/lib/auth'
import { announcementService } from '@/lib/services/announcement-service'
import {
  announcementCommentSchema,
  reactionEmojiSchema,
} from '@/lib/validations/announcement'

export interface ToggleReactionResult {
  ok: boolean
  added?: boolean
  error?: string
}

export async function toggleReactionAction(
  announcementId: string,
  emoji: string,
): Promise<ToggleReactionResult> {
  const user = await requireActiveUser()

  const parsed = reactionEmojiSchema.safeParse(emoji)
  if (!parsed.success) return { ok: false, error: 'Invalid emoji' }

  try {
    const result = await announcementService.toggleReaction(
      user.id,
      announcementId,
      parsed.data,
    )
    revalidatePath(`/announcements/${announcementId}`)
    revalidatePath('/announcements')
    return { ok: true, added: result.added }
  } catch (err) {
    console.error('toggleReaction failed:', err)
    return { ok: false, error: 'Could not save reaction' }
  }
}

export interface CommentSubmitResult {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

export async function createCommentAction(
  announcementId: string,
  formData: FormData,
): Promise<CommentSubmitResult> {
  const user = await requireActiveUser()

  const parsed = announcementCommentSchema.safeParse({
    body: formData.get('body') ?? '',
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
    await announcementService.createComment(
      announcementId,
      user.id,
      parsed.data.body.trim(),
    )
    revalidatePath(`/announcements/${announcementId}`)
    return { ok: true }
  } catch (err) {
    console.error('createComment failed:', err)
    return { ok: false, error: 'Could not post comment' }
  }
}

export interface SimpleResult {
  ok: boolean
  error?: string
}

export async function deleteCommentAction(
  announcementId: string,
  commentId: string,
): Promise<SimpleResult> {
  const user = await requireActiveUser()
  try {
    const deleted = await announcementService.softDeleteComment(
      commentId,
      user.id,
    )
    // Owners delete their own; admins / team can delete any.
    const isAdminOrTeam = user.role === 'ADMIN' || user.role === 'TEAM'
    if (deleted.userId !== user.id && !isAdminOrTeam) {
      return { ok: false, error: 'Not authorised' }
    }
    revalidatePath(`/announcements/${announcementId}`)
    return { ok: true }
  } catch (err) {
    console.error('deleteComment failed:', err)
    return { ok: false, error: 'Could not delete comment' }
  }
}

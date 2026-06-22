import { z } from 'zod'
import { idSchema } from './common'

export const announcementStatusSchema = z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED'])
export type AnnouncementStatus = z.infer<typeof announcementStatusSchema>

export const announcementCategorySchema = z.enum([
  'GENERAL',
  'OFFICE_HOURS',
  'COURSE_UPDATE',
  'IMPORTANT',
])
export type AnnouncementCategory = z.infer<typeof announcementCategorySchema>

export const ANNOUNCEMENT_CATEGORY_LABELS: Record<AnnouncementCategory, string> = {
  GENERAL: 'General',
  OFFICE_HOURS: 'Office hours',
  COURSE_UPDATE: 'Course update',
  IMPORTANT: 'Important',
}

// Body comes in as TipTap HTML. Cap the RAW byte length generously
// (50k) — admins should never hit it in normal use — and validate
// the visible-text length separately so a long bold-and-list
// message can't fail validation just because its markup is bulky.
// The visible-text check happens at the action layer where we have
// the htmlToPlainText helper.
const bodySchema = z
  .string()
  .min(1, 'Body is required')
  .max(50000, 'Body is too long')

export const createAnnouncementSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  body: bodySchema,
  status: announcementStatusSchema.default('DRAFT'),
  category: announcementCategorySchema.default('GENERAL'),
  pinned: z.boolean().default(false),
  scheduledAt: z.coerce.date().nullable().optional(),
})

export const updateAnnouncementSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: bodySchema.optional(),
  status: announcementStatusSchema.optional(),
  category: announcementCategorySchema.optional(),
  pinned: z.boolean().optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
})

// Reactions accept any single emoji-ish char. Tighter validation
// (proper emoji regex) is overkill; we just need to bound the bytes.
export const REACTION_EMOJI_MAX = 16
export const reactionEmojiSchema = z
  .string()
  .min(1, 'Pick an emoji')
  .max(REACTION_EMOJI_MAX, 'Not a single emoji')

export const ANNOUNCEMENT_REACTION_PRESETS = ['👍', '❤️', '🔥', '🎉', '👀', '🙏'] as const

// Comments are plain-text. Max kept generous but bounded so the
// dialog stays scannable.
export const COMMENT_BODY_MAX = 2_000
export const announcementCommentSchema = z.object({
  body: z.string().min(1, 'Write a comment').max(COMMENT_BODY_MAX, 'Comment is too long'),
})

// Surface-level cap on the visible (HTML-stripped) message body so
// extra markup doesn't punish admins. Tuned to comfortably fit a
// long Discord-style post.
export const BODY_TEXT_MAX = 10_000

export const announcementResponseSchema = z.object({
  id: idSchema,
  title: z.string(),
  body: z.string(),
  status: announcementStatusSchema,
  publishedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>
export type AnnouncementResponse = z.infer<typeof announcementResponseSchema>

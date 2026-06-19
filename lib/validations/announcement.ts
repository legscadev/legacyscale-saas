import { z } from 'zod'
import { idSchema } from './common'

export const announcementStatusSchema = z.enum(['DRAFT', 'PUBLISHED'])
export type AnnouncementStatus = z.infer<typeof announcementStatusSchema>

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
})

export const updateAnnouncementSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: bodySchema.optional(),
  status: announcementStatusSchema.optional(),
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

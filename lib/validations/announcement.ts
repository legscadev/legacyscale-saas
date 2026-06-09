import { z } from 'zod'
import { idSchema } from './common'

export const announcementStatusSchema = z.enum(['DRAFT', 'PUBLISHED'])
export type AnnouncementStatus = z.infer<typeof announcementStatusSchema>

export const createAnnouncementSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  body: z.string().min(1, 'Body is required').max(10000, 'Body is too long'),
  status: announcementStatusSchema.default('DRAFT'),
})

export const updateAnnouncementSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(10000).optional(),
  status: announcementStatusSchema.optional(),
})

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

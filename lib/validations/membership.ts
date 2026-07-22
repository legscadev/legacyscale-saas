import { z } from 'zod'

import { isValidSlug } from '@/lib/utils/slug'
import { idSchema } from './common'

// ============================================
// MEMBERSHIP
// ============================================

export const membershipNameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(80, 'Name is too long')
  .trim()

// Admin-provided slugs are validated for shape; blank is allowed
// because the service auto-derives one from the name when missing.
export const membershipSlugSchema = z
  .string()
  .max(80, 'Slug is too long')
  .refine((v) => v === '' || isValidSlug(v), {
    message: 'Slug may only contain lowercase letters, numbers, and hyphens',
  })

export const createMembershipSchema = z.object({
  name: membershipNameSchema,
  slug: membershipSlugSchema.optional(),
  description: z.string().max(500, 'Description is too long').optional(),
})

export const updateMembershipSchema = z
  .object({
    name: membershipNameSchema.optional(),
    slug: membershipSlugSchema.optional(),
    description: z.string().max(500).nullable().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Nothing to update',
  })

export const listMembershipsQuerySchema = z.object({
  search: z.string().max(100).optional(),
  sort: z.enum(['name', 'createdAt']).default('name'),
  direction: z.enum(['asc', 'desc']).default('asc'),
})

export const membershipResponseSchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type CreateMembershipInput = z.infer<typeof createMembershipSchema>
export type UpdateMembershipInput = z.infer<typeof updateMembershipSchema>
export type ListMembershipsQuery = z.infer<typeof listMembershipsQuerySchema>

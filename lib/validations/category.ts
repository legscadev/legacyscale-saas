import { z } from 'zod'

import { isValidSlug } from '@/lib/utils/slug'
import { idSchema } from './common'

// ============================================
// CATEGORY
// ============================================

export const categoryNameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(80, 'Name is too long')
  .trim()

// Admin-provided slugs are validated for shape; blank is allowed
// because the service auto-derives one from the name when missing.
export const categorySlugSchema = z
  .string()
  .max(80, 'Slug is too long')
  .refine((v) => v === '' || isValidSlug(v), {
    message: 'Slug may only contain lowercase letters, numbers, and hyphens',
  })

export const createCategorySchema = z.object({
  name: categoryNameSchema,
  slug: categorySlugSchema.optional(),
  description: z.string().max(500, 'Description is too long').optional(),
})

export const updateCategorySchema = z
  .object({
    name: categoryNameSchema.optional(),
    slug: categorySlugSchema.optional(),
    description: z.string().max(500).nullable().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Nothing to update',
  })

export const listCategoriesQuerySchema = z.object({
  search: z.string().max(100).optional(),
  sort: z.enum(['name', 'createdAt']).default('name'),
  direction: z.enum(['asc', 'desc']).default('asc'),
})

export const categoryResponseSchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>

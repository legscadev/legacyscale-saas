import { z } from 'zod'

// ============================================
// PRIMITIVE TYPES
// ============================================

export const idSchema = z.uuid('Invalid ID format')

// Empty check first so users see "Email is required" before the format
// error. z.email() with `error` only fires on non-empty, malformed input.
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .max(255, 'Email is too long')
  .pipe(z.email('Invalid email address'))

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password is too long')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain at least one uppercase letter, one lowercase letter, and one number'
  )

export const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name is too long')
  .trim()

export const urlSchema = z.url('Invalid URL format')

export const optionalUrlSchema = z
  .url('Invalid URL format')
  .optional()
  .or(z.literal(''))

// ============================================
// PAGINATION
// ============================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export type PaginationParams = z.infer<typeof paginationSchema>

export const paginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
    hasMore: z.boolean(),
  })

// ============================================
// SEARCH & FILTER
// ============================================

export const searchSchema = z.object({
  query: z.string().max(100).optional(),
})

export const dateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

// ============================================
// API RESPONSE SHAPES
// ============================================

export const successResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  })

export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
    details: z.record(z.string(), z.array(z.string())).optional(),
  }),
})

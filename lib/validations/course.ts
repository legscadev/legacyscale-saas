import { z } from 'zod'

import { isValidSlug } from '@/lib/utils/slug'
import { idSchema, optionalUrlSchema } from './common'

// ============================================
// ENUMS
// ============================================

export const courseStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
export const courseAudienceSchema = z.enum(['MEMBERS', 'INTERNAL', 'BOTH'])
export const lessonTypeSchema = z.enum(['VIDEO', 'QUIZ', 'RESOURCE'])
export const lessonStatusSchema = z.enum(['DRAFT', 'PROCESSING', 'READY'])
export const questionTypeSchema = z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE'])

export type CourseStatus = z.infer<typeof courseStatusSchema>
export type CourseAudience = z.infer<typeof courseAudienceSchema>
export type LessonType = z.infer<typeof lessonTypeSchema>
export type LessonStatus = z.infer<typeof lessonStatusSchema>
export type QuestionType = z.infer<typeof questionTypeSchema>

// ============================================
// COURSE
// ============================================

// `accessDays`: null means lifetime access; positive int means days
// granted from enrollment date. The form's "Forever" toggle maps to
// null.
export const accessDaysSchema = z
  .number()
  .int()
  .min(1, 'Access days must be at least 1')
  .max(36500, 'Access days is too large')
  .nullable()

// Admin-supplied slugs are validated for shape. Empty string is
// allowed because the service derives a slug from the title when
// the admin leaves the field blank.
export const courseSlugSchema = z
  .string()
  .max(80, 'Slug is too long')
  .refine((v) => v === '' || isValidSlug(v), {
    message: 'Slug may only contain lowercase letters, numbers, and hyphens',
  })

export const createCourseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  slug: courseSlugSchema.optional(),
  description: z.string().max(5000, 'Description is too long').optional(),
  thumbnailUrl: optionalUrlSchema,
  coverImageUrl: optionalUrlSchema,
  status: courseStatusSchema.default('DRAFT'),
  accessDays: accessDaysSchema.default(null),
  isFree: z.boolean().default(false),
  audience: courseAudienceSchema.default('MEMBERS'),
})

export const updateCourseSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    slug: courseSlugSchema.optional(),
    description: z.string().max(5000).optional(),
    thumbnailUrl: optionalUrlSchema,
    coverImageUrl: optionalUrlSchema,
    status: courseStatusSchema.optional(),
    accessDays: accessDaysSchema.optional(),
    isFree: z.boolean().optional(),
    audience: courseAudienceSchema.optional(),
    orderIndex: z.number().int().min(0).optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: 'Nothing to update' },
  )

// Query params for GET /api/admin/courses. Coerces strings off the
// URL into the right primitives.
export const listCoursesQuerySchema = z.object({
  search: z.string().max(100).optional(),
  status: courseStatusSchema.optional(),
  /**
   * 'active' (default) = exclude soft-deleted.
   * 'deleted' = show only soft-deleted.
   */
  view: z.enum(['active', 'deleted']).default('active'),
  sort: z.enum(['createdAt', 'title', 'orderIndex']).default('createdAt'),
  direction: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export type ListCoursesQuery = z.infer<typeof listCoursesQuerySchema>

export const courseResponseSchema = z.object({
  id: idSchema,
  title: z.string(),
  description: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  status: courseStatusSchema,
  orderIndex: z.number(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

// ============================================
// MODULE
// ============================================

export const createModuleSchema = z.object({
  courseId: idSchema,
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  description: z.string().max(2000, 'Description is too long').optional(),
})

export const updateModuleSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    orderIndex: z.number().int().min(0).optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: 'Nothing to update' },
  )

export const reorderModulesSchema = z.object({
  courseId: idSchema,
  orderedIds: z.array(idSchema).min(1, 'Order list cannot be empty'),
})

export const moduleResponseSchema = z.object({
  id: idSchema,
  courseId: idSchema,
  title: z.string(),
  description: z.string().nullable(),
  orderIndex: z.number(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

// ============================================
// CHAPTER
// ============================================

// `moduleId` is optional and nullable: null/missing = loose chapter
// (sits directly on the course); a UUID = chapter belongs to that
// module. The server enforces that the module, if set, belongs to
// the same course.
export const createChapterSchema = z.object({
  courseId: idSchema,
  moduleId: idSchema.nullish(),
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
})

export const updateChapterSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  orderIndex: z.number().int().min(0).optional(),
  // Moving between modules (or out to loose). undefined = no change.
  moduleId: idSchema.nullish(),
})

export const chapterResponseSchema = z.object({
  id: idSchema,
  courseId: idSchema,
  moduleId: idSchema.nullable(),
  title: z.string(),
  orderIndex: z.number(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

// ============================================
// LESSON
// ============================================

export const createLessonSchema = z.object({
  chapterId: idSchema,
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  type: lessonTypeSchema,
  description: z.string().max(5000).optional(),
})

export const updateLessonSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  status: lessonStatusSchema.optional(),
  orderIndex: z.number().int().min(0).optional(),
  // Video fields
  muxAssetId: z.string().optional(),
  muxPlaybackId: z.string().optional(),
  durationSeconds: z.number().int().min(0).optional(),
  // Resource fields
  resourceUrl: z.url().optional(),
  resourceName: z.string().max(255).optional(),
  resourceSize: z.number().int().min(0).optional(),
})

export const lessonResponseSchema = z.object({
  id: idSchema,
  chapterId: idSchema,
  title: z.string(),
  type: lessonTypeSchema,
  status: lessonStatusSchema,
  orderIndex: z.number(),
  description: z.string().nullable(),
  muxAssetId: z.string().nullable(),
  muxPlaybackId: z.string().nullable(),
  durationSeconds: z.number().nullable(),
  resourceUrl: z.string().nullable(),
  resourceName: z.string().nullable(),
  resourceSize: z.number().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

// ============================================
// QUIZ
// ============================================

export const createQuizQuestionSchema = z.object({
  lessonId: idSchema,
  questionText: z.string().min(1, 'Question is required').max(1000),
  type: questionTypeSchema,
  options: z.array(z.string().min(1).max(500)).min(2).max(6),
  correctIndex: z.number().int().min(0),
})

export const updateQuizQuestionSchema = z.object({
  questionText: z.string().min(1).max(1000).optional(),
  options: z.array(z.string().min(1).max(500)).min(2).max(6).optional(),
  correctIndex: z.number().int().min(0).optional(),
  orderIndex: z.number().int().min(0).optional(),
})

export const submitQuizSchema = z.object({
  lessonId: idSchema,
  answers: z.record(z.string(), z.number()),
})

export type CreateCourseInput = z.infer<typeof createCourseSchema>
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>
export type CreateModuleInput = z.infer<typeof createModuleSchema>
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>
export type ReorderModulesInput = z.infer<typeof reorderModulesSchema>
export type CreateChapterInput = z.infer<typeof createChapterSchema>
export type UpdateChapterInput = z.infer<typeof updateChapterSchema>
export type CreateLessonInput = z.infer<typeof createLessonSchema>
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>
export type CreateQuizQuestionInput = z.infer<typeof createQuizQuestionSchema>
export type SubmitQuizInput = z.infer<typeof submitQuizSchema>

import { z } from 'zod'
import { idSchema, optionalUrlSchema } from './common'

// ============================================
// ENUMS
// ============================================

export const courseStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
export const lessonTypeSchema = z.enum(['VIDEO', 'QUIZ', 'RESOURCE'])
export const lessonStatusSchema = z.enum(['DRAFT', 'PROCESSING', 'READY'])
export const questionTypeSchema = z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE'])

export type CourseStatus = z.infer<typeof courseStatusSchema>
export type LessonType = z.infer<typeof lessonTypeSchema>
export type LessonStatus = z.infer<typeof lessonStatusSchema>
export type QuestionType = z.infer<typeof questionTypeSchema>

// ============================================
// COURSE
// ============================================

export const createCourseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  description: z.string().max(5000, 'Description is too long').optional(),
  thumbnailUrl: optionalUrlSchema,
  status: courseStatusSchema.default('DRAFT'),
})

export const updateCourseSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  thumbnailUrl: optionalUrlSchema,
  status: courseStatusSchema.optional(),
  orderIndex: z.number().int().min(0).optional(),
})

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
// CHAPTER
// ============================================

export const createChapterSchema = z.object({
  courseId: idSchema,
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
})

export const updateChapterSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  orderIndex: z.number().int().min(0).optional(),
})

export const chapterResponseSchema = z.object({
  id: idSchema,
  courseId: idSchema,
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
export type CreateChapterInput = z.infer<typeof createChapterSchema>
export type UpdateChapterInput = z.infer<typeof updateChapterSchema>
export type CreateLessonInput = z.infer<typeof createLessonSchema>
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>
export type CreateQuizQuestionInput = z.infer<typeof createQuizQuestionSchema>
export type SubmitQuizInput = z.infer<typeof submitQuizSchema>

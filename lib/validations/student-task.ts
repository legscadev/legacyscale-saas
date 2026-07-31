// Zod schemas for the personal student task/goal surface. Kept lean
// on purpose — this is the member's own to-do list, not a shared
// workflow, so we don't need multi-owner or assignee facets.

import { z } from 'zod'

/** yyyy-MM-dd (or empty) → Date | null. Matches the CRM/task
 *  pattern so date inputs from the form deserialise consistently. */
const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || !Number.isNaN(new Date(v).getTime()), {
    message: 'Invalid date',
  })
  .transform((v) => (v === null ? null : new Date(v)))
  .nullable()

export const createStudentTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(20_000).nullable().optional(),
  dueDate: optionalDate.optional(),
  linkedCourseId: z.string().uuid().nullable().optional(),
  linkedLessonId: z.string().uuid().nullable().optional(),
})
export type CreateStudentTaskInput = z.input<typeof createStudentTaskSchema>
export type CreateStudentTaskOutput = z.output<typeof createStudentTaskSchema>

export const updateStudentTaskSchema = z.object({
  taskId: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(20_000).nullable().optional(),
  dueDate: optionalDate.optional(),
  linkedCourseId: z.string().uuid().nullable().optional(),
  linkedLessonId: z.string().uuid().nullable().optional(),
})
export type UpdateStudentTaskInput = z.input<typeof updateStudentTaskSchema>

export const toggleStudentTaskSchema = z.object({
  taskId: z.string().uuid(),
  completed: z.boolean(),
})

export const deleteStudentTaskSchema = z.object({
  taskId: z.string().uuid(),
})

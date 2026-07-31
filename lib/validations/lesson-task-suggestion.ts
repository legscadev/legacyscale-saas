// Zod schemas for the LessonTaskSuggestion admin CRUD + the
// student "add to my tasks" one-click flow.

import { z } from 'zod'

/** yyyy-MM-dd (or empty) → Date | null. Matches the student-task
 *  optional date parser. */
const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || !Number.isNaN(new Date(v).getTime()), {
    message: 'Invalid date',
  })
  .transform((v) => (v === null ? null : new Date(v)))
  .nullable()

// IDs are validated as non-empty strings, not UUIDs — the Lesson /
// LessonTaskSuggestion `id` columns are `String`, and seed data
// (sample-lesson-1, etc.) is intentionally non-UUID. Uniqueness and
// referential integrity are guaranteed by the DB, not the API layer.
const idString = z.string().min(1)

// ---- Admin CRUD ----

export const createLessonTaskSuggestionSchema = z.object({
  lessonId: idString,
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(20_000).nullable().optional(),
})
export type CreateLessonTaskSuggestionInput = z.input<
  typeof createLessonTaskSuggestionSchema
>

export const updateLessonTaskSuggestionSchema = z.object({
  suggestionId: idString,
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(20_000).nullable().optional(),
})

export const deleteLessonTaskSuggestionSchema = z.object({
  suggestionId: idString,
})

export const reorderLessonTaskSuggestionsSchema = z.object({
  lessonId: idString,
  suggestionIds: z.array(idString).min(1),
})

// ---- Student one-click "add to my tasks" ----

export const addSuggestionToTasksSchema = z.object({
  suggestionId: idString,
  dueDate: optionalDate.optional(),
})
export type AddSuggestionToTasksInput = z.input<
  typeof addSuggestionToTasksSchema
>

import { z } from 'zod'

// Cap at 50k chars — long-form notes are fine, absurd payloads (e.g.
// a pasted PDF) get rejected at the boundary instead of bloating the
// notes table.
const CONTENT_MAX = 50_000

export const upsertNoteSchema = z.object({
  content: z.string().max(CONTENT_MAX, 'Note is too long'),
})

export const lessonIdParamSchema = z.object({
  lessonId: z.uuid('Invalid lesson ID'),
})

export type UpsertNoteInput = z.infer<typeof upsertNoteSchema>

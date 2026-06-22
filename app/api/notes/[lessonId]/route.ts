import { type NextRequest } from 'next/server'

import { requireUser } from '@/lib/auth/get-user'
import {
  successResponse,
  validateBody,
  validateParams,
  withErrorHandling,
} from '@/lib/api/helpers'
import { getNote, upsertNote } from '@/lib/services/note-service'
import {
  lessonIdParamSchema,
  upsertNoteSchema,
} from '@/lib/validations/note'

interface RouteContext {
  params: Promise<{ lessonId: string }>
}

// GET /api/notes/[lessonId] — load the current user's note for a
// lesson. Returns `{ content: '', updatedAt: null }` when no row
// exists so the client always has a defined shape to render.
export const GET = withErrorHandling(
  async (_req: NextRequest, context: RouteContext) => {
    const user = await requireUser()
    const params = await context.params
    const validation = validateParams(params, lessonIdParamSchema)
    if (validation.error) return validation.error

    const note = await getNote(user.id, validation.data.lessonId)
    return successResponse(note)
  },
)

// PUT /api/notes/[lessonId] — upsert the current user's note. The
// userId comes from the session — never from the request body —
// so a member can only ever write to their own row.
export const PUT = withErrorHandling(
  async (request: NextRequest, context: RouteContext) => {
    const user = await requireUser()
    const params = await context.params
    const paramValidation = validateParams(params, lessonIdParamSchema)
    if (paramValidation.error) return paramValidation.error

    const bodyValidation = await validateBody(request, upsertNoteSchema)
    if (bodyValidation.error) return bodyValidation.error

    const note = await upsertNote(
      user.id,
      paramValidation.data.lessonId,
      bodyValidation.data.content,
    )
    return successResponse(note)
  },
)

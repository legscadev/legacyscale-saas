import { type NextRequest } from 'next/server'
import { z } from 'zod'
import {
  successResponse,
  validateBody,
  withErrorHandling,
} from '@/lib/api'
import { requireAdminApi } from '@/lib/auth'
import { createDirectUpload } from '@/lib/mux'

const createUploadSchema = z.object({
  lessonId: z.uuid('Invalid lesson id'),
})

// POST /api/uploads/video
// Returns a one-shot Mux direct-upload URL the client can PUT a video to.
// Admin-only. The lesson id is passed as Mux `passthrough` so the webhook
// can wire the resulting asset back to the lesson.
export const POST = withErrorHandling(async (request: NextRequest) => {
  await requireAdminApi()

  const validation = await validateBody(request, createUploadSchema)
  if (validation.error) return validation.error

  const { lessonId } = validation.data

  const upload = await createDirectUpload({
    corsOrigin: process.env.NEXT_PUBLIC_APP_URL ?? '*',
    passthrough: lessonId,
    playbackPolicy: ['public'],
  })

  return successResponse(upload)
})

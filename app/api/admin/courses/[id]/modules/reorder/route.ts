import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { requireAdmin } from '@/lib/auth/get-user'
import {
  serverErrorResponse,
  successResponse,
  validateBody,
} from '@/lib/api/helpers'
import { moduleService } from '@/lib/services/module-service'
import { idSchema } from '@/lib/validations/common'

interface RouteContext {
  params: Promise<{ id: string }>
}

// The path supplies the courseId, so the body only needs the ordered
// id list. Modules not in the list are left at their current
// orderIndex (matches chapter-service.reorder semantics).
const bodySchema = z.object({
  orderedIds: z.array(idSchema).min(1, 'Order list cannot be empty'),
})

export async function POST(request: NextRequest, context: RouteContext) {
  await requireAdmin()
  const { id: courseId } = await context.params

  const validation = await validateBody(request, bodySchema)
  if (validation.error) return validation.error

  try {
    await moduleService.reorder(courseId, validation.data.orderedIds)
    return successResponse({ ok: true })
  } catch (err) {
    console.error('Module reorder failed:', err)
    return serverErrorResponse()
  }
}

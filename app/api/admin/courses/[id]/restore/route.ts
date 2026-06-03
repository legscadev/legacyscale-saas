import { type NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

import { requireAdmin } from '@/lib/auth/get-user'
import {
  notFoundResponse,
  serverErrorResponse,
  successResponse,
} from '@/lib/api/helpers'
import { courseService } from '@/lib/services/course-service'

interface RouteContext {
  params: Promise<{ id: string }>
}

// Clears `deletedAt` on a soft-deleted course. Status stays whatever
// it was before the delete — admin can re-publish explicitly.
export async function POST(_req: NextRequest, context: RouteContext) {
  await requireAdmin()
  const { id } = await context.params

  try {
    await courseService.restore(id)
    return successResponse({ id })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      return notFoundResponse('Course')
    }
    console.error('Course restore failed:', err)
    return serverErrorResponse()
  }
}

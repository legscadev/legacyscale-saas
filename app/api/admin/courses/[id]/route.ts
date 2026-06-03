import { type NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

import { requireAdmin } from '@/lib/auth/get-user'
import {
  notFoundResponse,
  serverErrorResponse,
  successResponse,
  validateBody,
} from '@/lib/api/helpers'
import { courseService } from '@/lib/services/course-service'
import { updateCourseSchema } from '@/lib/validations/course'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, context: RouteContext) {
  await requireAdmin()
  const { id } = await context.params

  const course = await courseService.getById(id)
  if (!course) return notFoundResponse('Course')

  return successResponse({ course })
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  await requireAdmin()
  const { id } = await context.params

  const validation = await validateBody(request, updateCourseSchema)
  if (validation.error) return validation.error

  try {
    const course = await courseService.update(id, validation.data)
    return successResponse({ course })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      return notFoundResponse('Course')
    }
    console.error('Course update failed:', err)
    return serverErrorResponse()
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  await requireAdmin()
  const { id } = await context.params

  try {
    await courseService.softDelete(id)
    return successResponse({ id })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      return notFoundResponse('Course')
    }
    console.error('Course delete failed:', err)
    return serverErrorResponse()
  }
}

import { type NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

import { requireAdmin } from '@/lib/auth/get-user'
import {
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  successResponse,
  validateBody,
} from '@/lib/api/helpers'
import { moduleService } from '@/lib/services/module-service'
import { createModuleSchema } from '@/lib/validations/course'

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET /api/admin/courses/:id/modules — list modules on this course
export async function GET(_req: NextRequest, context: RouteContext) {
  await requireAdmin()
  const { id: courseId } = await context.params

  const modules = await moduleService.list(courseId)
  return successResponse({ modules })
}

// POST /api/admin/courses/:id/modules — create a module under this course
export async function POST(request: NextRequest, context: RouteContext) {
  await requireAdmin()
  const { id: courseId } = await context.params

  const validation = await validateBody(request, createModuleSchema)
  if (validation.error) return validation.error

  // The path-param courseId is the source of truth; reject if the body
  // disagrees so callers can't sneak a different course in.
  if (validation.data.courseId !== courseId) {
    return errorResponse('courseId mismatch between path and body', 400)
  }

  try {
    const moduleRow = await moduleService.create({
      courseId,
      title: validation.data.title,
      description: validation.data.description ?? null,
    })
    return successResponse({ module: moduleRow }, 201)
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2003'
    ) {
      return notFoundResponse('Course')
    }
    console.error('Module create failed:', err)
    return serverErrorResponse()
  }
}

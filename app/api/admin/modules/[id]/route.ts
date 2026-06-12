import { type NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

import { requireAdmin } from '@/lib/auth/get-user'
import {
  notFoundResponse,
  serverErrorResponse,
  successResponse,
  validateBody,
} from '@/lib/api/helpers'
import { moduleService } from '@/lib/services/module-service'
import { updateModuleSchema } from '@/lib/validations/course'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, context: RouteContext) {
  await requireAdmin()
  const { id } = await context.params

  const moduleRow = await moduleService.getById(id)
  if (!moduleRow) return notFoundResponse('Module')

  return successResponse({ module: moduleRow })
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  await requireAdmin()
  const { id } = await context.params

  const validation = await validateBody(request, updateModuleSchema)
  if (validation.error) return validation.error

  try {
    const moduleRow = await moduleService.update(id, validation.data)
    return successResponse({ module: moduleRow })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      return notFoundResponse('Module')
    }
    console.error('Module update failed:', err)
    return serverErrorResponse()
  }
}

// Hard delete. Chapter.module has `onDelete: SetNull`, so chapters
// under this module become loose chapters on the same course.
export async function DELETE(_req: NextRequest, context: RouteContext) {
  await requireAdmin()
  const { id } = await context.params

  try {
    await moduleService.delete(id)
    return successResponse({ id })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      return notFoundResponse('Module')
    }
    console.error('Module delete failed:', err)
    return serverErrorResponse()
  }
}

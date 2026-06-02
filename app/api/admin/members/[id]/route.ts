import { type NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

import { requireAdmin } from '@/lib/auth/get-user'
import { prisma } from '@/lib/prisma'
import {
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  successResponse,
  validateBody,
} from '@/lib/api/helpers'
import { updateUserStatusSchema } from '@/lib/validations/user'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  const { id } = await context.params

  const validation = await validateBody(request, updateUserStatusSchema)
  if (validation.error) return validation.error

  if (id === admin.id) {
    return errorResponse("You can't change your own access status", 400)
  }

  try {
    const user = await prisma.user.update({
      where: { id, deletedAt: null },
      data: { isActive: validation.data.isActive },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    })

    // Note: existing sessions remain valid until they refresh, but
    // every protected route runs requireActiveUser() which re-checks
    // isActive against the DB — so a deactivated member is bounced to
    // /account-paused on their very next request.
    return successResponse({ member: user })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      return notFoundResponse('Member')
    }
    console.error('Member status update failed:', err)
    return serverErrorResponse()
  }
}

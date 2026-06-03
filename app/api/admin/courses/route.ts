import { type NextRequest } from 'next/server'

import { requireAdmin } from '@/lib/auth/get-user'
import {
  errorResponse,
  paginatedResult,
  successResponse,
  validateBody,
  validateSearchParams,
} from '@/lib/api/helpers'
import { courseService } from '@/lib/services/course-service'
import {
  createCourseSchema,
  listCoursesQuerySchema,
} from '@/lib/validations/course'

export async function GET(request: NextRequest) {
  await requireAdmin()

  const { searchParams } = new URL(request.url)
  const validation = validateSearchParams(searchParams, listCoursesQuerySchema)
  if (validation.error) return validation.error

  const q = validation.data
  const result = await courseService.list({
    search: q.search,
    status: q.status ?? null,
    view: q.view,
    sort: q.sort,
    direction: q.direction,
    page: q.page,
    limit: q.limit,
  })

  return successResponse(
    paginatedResult(result.items, result.total, result.page, result.limit),
  )
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()

  const validation = await validateBody(request, createCourseSchema)
  if (validation.error) return validation.error

  try {
    const course = await courseService.create(validation.data, admin.id)
    return successResponse({ course }, 201)
  } catch (err) {
    console.error('Course create failed:', err)
    return errorResponse('Failed to create course', 500)
  }
}

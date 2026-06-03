'use server'

import type { CourseStatus } from '@prisma/client'

import { requireAdmin } from '@/lib/auth/get-user'
import {
  courseService,
  type CourseCounts,
  type CourseListItem,
  type CourseSortField,
  type CourseView,
  type SortDirection,
} from '@/lib/services/course-service'

export interface CoursesQueryState {
  search: string
  status: CourseStatus | null
  view: CourseView
  sort: CourseSortField
  direction: SortDirection
  page: number
}

export interface CoursesData {
  counts: CourseCounts
  items: CourseListItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export async function fetchCourses(
  state: CoursesQueryState,
): Promise<CoursesData> {
  await requireAdmin()

  const [counts, result] = await Promise.all([
    courseService.counts(),
    courseService.list({
      search: state.search || undefined,
      status: state.status,
      view: state.view,
      sort: state.sort,
      direction: state.direction,
      page: state.page,
      limit: courseService.defaultPageSize,
    }),
  ])

  return {
    counts,
    items: result.items,
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  }
}

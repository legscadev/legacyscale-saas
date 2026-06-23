import { Prisma, type CourseStatus } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { ensureUniqueSlug, slugify } from '@/lib/utils/slug'
import type {
  CreateCourseInput,
  UpdateCourseInput,
} from '@/lib/validations/course'

export type CourseSortField = 'createdAt' | 'title' | 'orderIndex'
export type SortDirection = 'asc' | 'desc'
export type CourseView = 'active' | 'deleted'

interface ListCoursesOptions {
  search?: string
  status?: CourseStatus | null
  view?: CourseView
  sort?: CourseSortField
  direction?: SortDirection
  page: number
  limit: number
}

const DEFAULT_PAGE_SIZE = 10

function buildWhere(opts: ListCoursesOptions): Prisma.CourseWhereInput {
  const { search, status, view = 'active' } = opts

  const baseWhere: Prisma.CourseWhereInput =
    view === 'deleted' ? { deletedAt: { not: null } } : { deletedAt: null }

  const filters: Prisma.CourseWhereInput = {}
  if (status) filters.status = status

  const searchWhere: Prisma.CourseWhereInput | undefined = search?.trim()
    ? {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }
    : undefined

  return {
    AND: [baseWhere, filters, ...(searchWhere ? [searchWhere] : [])],
  }
}

function buildOrderBy(
  opts: ListCoursesOptions,
): Prisma.CourseOrderByWithRelationInput {
  const { sort = 'createdAt', direction = 'desc' } = opts
  if (sort === 'title') return { title: direction }
  if (sort === 'orderIndex') return { orderIndex: direction }
  return { createdAt: direction }
}

const courseListSelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  thumbnailUrl: true,
  coverImageUrl: true,
  status: true,
  isFree: true,
  audience: true,
  accessDays: true,
  orderIndex: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  _count: { select: { chapters: true } },
  // Fetch only nested lesson counts (no lesson rows). Cheap because
  // chapter-per-course is small (< 50 typically).
  chapters: {
    select: { _count: { select: { lessons: true } } },
  },
  categories: {
    select: {
      category: {
        select: { id: true, name: true, slug: true },
      },
    },
  },
} satisfies Prisma.CourseSelect

type CourseListRow = Prisma.CourseGetPayload<{ select: typeof courseListSelect }>

function withLessonCount(row: CourseListRow) {
  const { chapters, categories, _count, ...rest } = row
  const lessons = chapters.reduce((sum, c) => sum + c._count.lessons, 0)
  return {
    ...rest,
    chaptersCount: _count.chapters,
    lessonsCount: lessons,
    categories: categories.map((c) => c.category),
  }
}

async function listCourses(options: ListCoursesOptions) {
  const { page, limit } = options
  const where = buildWhere(options)
  const orderBy = buildOrderBy(options)
  const skip = (page - 1) * limit

  const [rows, total] = await Promise.all([
    prisma.course.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      select: courseListSelect,
    }),
    prisma.course.count({ where }),
  ])

  return {
    items: rows.map(withLessonCount),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

/** Counts used by the filter chips. One round trip. */
async function getCounts() {
  const [groups, deleted] = await Promise.all([
    prisma.course.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.course.count({ where: { deletedAt: { not: null } } }),
  ])

  const totals = { all: 0, draft: 0, published: 0, archived: 0, deleted }
  for (const g of groups) {
    const n = g._count._all
    totals.all += n
    if (g.status === 'DRAFT') totals.draft += n
    if (g.status === 'PUBLISHED') totals.published += n
    if (g.status === 'ARCHIVED') totals.archived += n
  }
  return totals
}

async function getCourseById(id: string) {
  const row = await prisma.course.findFirst({
    where: { id, deletedAt: null },
    select: courseListSelect,
  })
  return row ? withLessonCount(row) : null
}

async function getCourseBySlug(slug: string) {
  const row = await prisma.course.findFirst({
    where: { slug, deletedAt: null },
    select: courseListSelect,
  })
  return row ? withLessonCount(row) : null
}

async function isSlugTakenByOther(slug: string, excludeId?: string) {
  const hit = await prisma.course.findUnique({
    where: { slug },
    select: { id: true },
  })
  return hit !== null && hit.id !== excludeId
}

/**
 * Resolves the slug to write to a course row. If the admin supplied
 * one, validates it doesn't collide. Otherwise derives from the title
 * and appends `-2`, `-3`, … until free.
 */
async function resolveSlug(opts: {
  desired: string | undefined
  title: string
  existingId?: string
}): Promise<string> {
  const { desired, title, existingId } = opts
  if (desired && desired.length > 0) {
    if (await isSlugTakenByOther(desired, existingId)) {
      throw new Error('That slug is already in use')
    }
    return desired
  }
  return ensureUniqueSlug(slugify(title) || 'course', (candidate) =>
    isSlugTakenByOther(candidate, existingId),
  )
}

async function createCourse(
  input: CreateCourseInput,
  createdBy: string,
  options?: { id?: string },
) {
  const last = await prisma.course.findFirst({
    where: { deletedAt: null },
    orderBy: { orderIndex: 'desc' },
    select: { orderIndex: true },
  })
  const orderIndex = (last?.orderIndex ?? -1) + 1

  const shouldPublishNow = input.status === 'PUBLISHED'
  const slug = await resolveSlug({ desired: input.slug, title: input.title })
  const categoryIds = input.categoryIds ?? []

  const row = await prisma.course.create({
    data: {
      ...(options?.id ? { id: options.id } : {}),
      title: input.title,
      slug,
      description: input.description,
      thumbnailUrl: input.thumbnailUrl || null,
      coverImageUrl: input.coverImageUrl || null,
      status: input.status,
      isFree: input.isFree ?? false,
      audience: input.audience ?? 'MEMBERS',
      accessDays: input.accessDays ?? null,
      orderIndex,
      createdBy,
      publishedAt: shouldPublishNow ? new Date() : null,
      categories: categoryIds.length
        ? { create: categoryIds.map((categoryId) => ({ categoryId })) }
        : undefined,
    },
    select: courseListSelect,
  })
  return withLessonCount(row)
}

async function updateCourse(id: string, input: UpdateCourseInput) {
  // If status is transitioning to PUBLISHED and the row has never been
  // published before, stamp publishedAt. Re-publishing leaves the
  // original publishedAt alone.
  const data: Prisma.CourseUpdateInput = {}
  if (input.title !== undefined) data.title = input.title
  if (input.description !== undefined) data.description = input.description
  if (input.thumbnailUrl !== undefined) {
    data.thumbnailUrl = input.thumbnailUrl || null
  }
  if (input.coverImageUrl !== undefined) {
    data.coverImageUrl = input.coverImageUrl || null
  }
  if (input.accessDays !== undefined) data.accessDays = input.accessDays
  if (input.isFree !== undefined) data.isFree = input.isFree
  if (input.audience !== undefined) data.audience = input.audience
  if (input.orderIndex !== undefined) data.orderIndex = input.orderIndex

  if (input.slug !== undefined) {
    if (input.slug.length === 0) {
      // Caller explicitly cleared the field — re-derive from title.
      const title = input.title ?? (await prisma.course.findUniqueOrThrow({
        where: { id },
        select: { title: true },
      })).title
      data.slug = await resolveSlug({ desired: undefined, title, existingId: id })
    } else {
      data.slug = await resolveSlug({
        desired: input.slug,
        title: input.title ?? '',
        existingId: id,
      })
    }
  }

  if (input.status !== undefined) {
    data.status = input.status
    if (input.status === 'PUBLISHED') {
      const current = await prisma.course.findUnique({
        where: { id },
        select: { publishedAt: true },
      })
      if (current && current.publishedAt === null) {
        data.publishedAt = new Date()
      }
    }
  }

  // Replace-all semantics for category memberships: delete then create
  // inside a transaction so the row never appears with a partial set.
  if (input.categoryIds !== undefined) {
    await prisma.$transaction([
      prisma.courseCategory.deleteMany({ where: { courseId: id } }),
      ...(input.categoryIds.length
        ? [
            prisma.courseCategory.createMany({
              data: input.categoryIds.map((categoryId) => ({
                courseId: id,
                categoryId,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ])
  }

  const row = await prisma.course.update({
    where: { id },
    data,
    select: courseListSelect,
  })
  return withLessonCount(row)
}

async function softDeleteCourse(id: string) {
  return prisma.course.update({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date() },
    select: { id: true },
  })
}

async function restoreCourse(id: string) {
  return prisma.course.update({
    where: { id, deletedAt: { not: null } },
    data: { deletedAt: null },
    select: { id: true },
  })
}

export const courseService = {
  list: listCourses,
  counts: getCounts,
  getById: getCourseById,
  getBySlug: getCourseBySlug,
  create: createCourse,
  update: updateCourse,
  softDelete: softDeleteCourse,
  restore: restoreCourse,
  defaultPageSize: DEFAULT_PAGE_SIZE,
}

export type CourseListItem = Awaited<
  ReturnType<typeof listCourses>
>['items'][number]
export type CourseCounts = Awaited<ReturnType<typeof getCounts>>
export type CourseDetail = NonNullable<
  Awaited<ReturnType<typeof getCourseById>>
>


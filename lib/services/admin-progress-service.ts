import type {
  CourseStatus,
  EnrollmentSource,
  EnrollmentStatus,
  LessonStatus,
  LessonType,
  Prisma,
  Role,
} from '@prisma/client'

import { requireAdmin } from '@/lib/auth/get-user'
import { prisma } from '@/lib/prisma'

// Admin-only progress aggregation. Surfaces under /admin/progress/*
// read from here, not from member-course-service (which is scoped to
// the signed-in user's own data). Every public method calls
// requireAdmin() defensively — this is intentional duplication with
// the route/layout-level gate (defense in depth) so that any future
// non-admin route that imports this service still 403s cleanly.
//
// The auth check is cheap (cookie read + a cached supabase getUser
// call), so the redundancy is negligible at runtime.
//
// Methods are added per build step:
//   Step 2 (Overview): getOverviewKpis, getMostEngagedMembers,
//                      getTopCourses, getRecentCompletions
//   Step 3 (Members):  listMembersWithProgress, getMemberProgress,
//                      getMemberCourseProgress
//   Step 4 (Courses):  listCoursesWithProgress, getCourseProgressSummary,
//                      getCourseCohort, exportCourseCohortCsv

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

/** Hard upper bound on rows returned by exportCourseCohortCsv. Chosen
 *  to keep the response body and memory footprint safe for the
 *  Vercel/Edge runtime; the export marker tells the operator if the
 *  download was clipped. */
const CSV_EXPORT_MAX_ROWS = 10_000

// ============================================
// SHARED — DATE RANGE FILTER
// ============================================

/**
 * Overview/dashboard date-range filter. Methods that accept this
 * narrow their date-based aggregations (engagement, completions,
 * activity) to the implied window. "all" disables the window —
 * useful for the admin's "lifetime stats" view.
 */
export type RangeFilter = '7d' | '30d' | '90d' | 'all'

/** Cutoff `Date` for a RangeFilter. Returns null for "all" so callers
 *  can omit the date filter entirely. */
export function rangeStart(range: RangeFilter): Date | null {
  switch (range) {
    case '7d':
      return new Date(Date.now() - SEVEN_DAYS_MS)
    case '30d':
      return new Date(Date.now() - THIRTY_DAYS_MS)
    case '90d':
      return new Date(Date.now() - NINETY_DAYS_MS)
    case 'all':
      return null
  }
}

/** Human label for a RangeFilter, suitable for KPI descriptions. */
export function rangeLabel(range: RangeFilter): string {
  switch (range) {
    case '7d':
      return 'last 7 days'
    case '30d':
      return 'last 30 days'
    case '90d':
      return 'last 90 days'
    case 'all':
      return 'all time'
  }
}

// ============================================
// STEP 2 — OVERVIEW
// ============================================

export interface OverviewKpis {
  /** Members + Team users that are active (platform snapshot —
   *  range-independent). */
  activeMembers: number
  /** Non-revoked enrollments started in the selected range
   *  (all-time when range = "all"). */
  enrollmentsInRange: number
  /** Average progress across enrollments touched in the selected
   *  range (enrolled / accessed / completed in window). 0-100. */
  avgProgressPercent: number
  /** Completions in range / non-revoked enrollments touched in range.
   *  0-100. */
  completionRate: number
  /** Distinct users whose `lastAccessedAt` falls in the selected
   *  range. Renders as "Active learners". */
  activeLearners: number
  /** Echoed back so the page can label the strip. */
  range: RangeFilter
}

async function getOverviewKpis(
  range: RangeFilter = '30d',
): Promise<OverviewKpis> {
  await requireAdmin()
  const start = rangeStart(range)

  // "Touched in range" = enrollment has any relevant timestamp
  // (enrolled, last accessed, or completed) within the window. Same
  // filter feeds both the avg-progress and completion-rate
  // denominators below.
  const touchedFilter = start
    ? {
        OR: [
          { enrolledAt: { gte: start } },
          { lastAccessedAt: { gte: start } },
          { completedAt: { gte: start } },
        ],
      }
    : {}
  const enrolledFilter = start ? { enrolledAt: { gte: start } } : {}
  const completedFilter = start
    ? { completedAt: { gte: start } }
    : { completedAt: { not: null } }
  const accessedFilter = start ? { lastAccessedAt: { gte: start } } : {}

  const [
    activeMembers,
    enrollmentsInRange,
    completedInRange,
    touchedTotal,
    progressAgg,
    activeLearnerRows,
  ] = await Promise.all([
    prisma.user.count({
      where: {
        role: { in: ['MEMBER', 'TEAM'] },
        isActive: true,
        deletedAt: null,
      },
    }),
    prisma.enrollment.count({
      where: { status: { not: 'REVOKED' }, ...enrolledFilter },
    }),
    prisma.enrollment.count({ where: completedFilter }),
    prisma.enrollment.count({
      where: { status: { not: 'REVOKED' }, ...touchedFilter },
    }),
    prisma.enrollment.aggregate({
      where: { status: { not: 'REVOKED' }, ...touchedFilter },
      _avg: { progressPercent: true },
    }),
    prisma.enrollment.findMany({
      where: accessedFilter,
      select: { userId: true },
      distinct: ['userId'],
    }),
  ])

  return {
    activeMembers,
    enrollmentsInRange,
    avgProgressPercent: Math.round(progressAgg._avg.progressPercent ?? 0),
    completionRate:
      touchedTotal > 0
        ? Math.round((completedInRange / touchedTotal) * 100)
        : 0,
    activeLearners: activeLearnerRows.length,
    range,
  }
}

export interface EngagedMember {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
  role: Role
  /** Lessons completed in the last 30 days. */
  completedLessons: number
  /** Most recent completion timestamp within the queried range. */
  lastActivity: Date | null
}

async function getMostEngagedMembers(
  limit = 5,
  range: RangeFilter = '30d',
): Promise<EngagedMember[]> {
  await requireAdmin()
  const start = rangeStart(range)

  const grouped = await prisma.lessonProgress.groupBy({
    by: ['userId'],
    where: {
      completed: true,
      ...(start ? { completedAt: { gte: start } } : {}),
    },
    _count: { _all: true },
    _max: { completedAt: true },
    orderBy: { _count: { lessonId: 'desc' } },
    take: limit,
  })

  if (grouped.length === 0) return []

  const users = await prisma.user.findMany({
    where: { id: { in: grouped.map((g) => g.userId) } },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      role: true,
    },
  })
  const userMap = new Map(users.map((u) => [u.id, u]))

  return grouped.flatMap((g) => {
    const u = userMap.get(g.userId)
    if (!u) return []
    return [
      {
        id: u.id,
        name: u.name,
        email: u.email,
        avatarUrl: u.avatarUrl,
        role: u.role,
        completedLessons: g._count._all,
        lastActivity: g._max.completedAt,
      },
    ]
  })
}

export interface TopCourseItem {
  id: string
  title: string
  thumbnailUrl: string | null
  enrolledCount: number
  completedCount: number
  completionRate: number
  avgProgressPercent: number
}

async function getTopCourses(
  limit = 5,
  range: RangeFilter = '30d',
): Promise<TopCourseItem[]> {
  await requireAdmin()
  // Rank courses by enrollments started in the selected window
  // (all-time when range = "all"). Pulls top N then fetches course
  // meta + completion counts in parallel.
  const start = rangeStart(range)
  const enrollmentWhere = {
    status: { not: 'REVOKED' as const },
    ...(start ? { enrolledAt: { gte: start } } : {}),
  }
  const grouped = await prisma.enrollment.groupBy({
    by: ['courseId'],
    where: enrollmentWhere,
    _count: { _all: true },
    _avg: { progressPercent: true },
    orderBy: { _count: { userId: 'desc' } },
    take: limit,
  })

  if (grouped.length === 0) return []

  const courseIds = grouped.map((g) => g.courseId)
  const [courses, completedCounts] = await Promise.all([
    prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true, title: true, thumbnailUrl: true },
    }),
    prisma.enrollment.groupBy({
      by: ['courseId'],
      where: {
        courseId: { in: courseIds },
        completedAt: start ? { gte: start } : { not: null },
      },
      _count: { _all: true },
    }),
  ])

  const courseMap = new Map(courses.map((c) => [c.id, c]))
  const completedMap = new Map(
    completedCounts.map((c) => [c.courseId, c._count._all]),
  )

  return grouped.flatMap((g) => {
    const course = courseMap.get(g.courseId)
    if (!course) return []
    const enrolled = g._count._all
    const completed = completedMap.get(g.courseId) ?? 0
    return [
      {
        id: course.id,
        title: course.title,
        thumbnailUrl: course.thumbnailUrl,
        enrolledCount: enrolled,
        completedCount: completed,
        completionRate:
          enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0,
        avgProgressPercent: Math.round(g._avg.progressPercent ?? 0),
      },
    ]
  })
}

export interface RecentCompletion {
  enrollmentId: string
  completedAt: Date
  user: {
    id: string
    name: string | null
    email: string
    avatarUrl: string | null
  }
  course: {
    id: string
    title: string
  }
}

async function getRecentCompletions(
  limit = 10,
  range: RangeFilter = '30d',
): Promise<RecentCompletion[]> {
  await requireAdmin()
  const start = rangeStart(range)
  const rows = await prisma.enrollment.findMany({
    where: {
      completedAt: start ? { gte: start } : { not: null },
    },
    orderBy: { completedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      completedAt: true,
      user: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
      course: { select: { id: true, title: true } },
    },
  })

  return rows.flatMap((r) =>
    r.completedAt
      ? [
          {
            enrollmentId: r.id,
            completedAt: r.completedAt,
            user: r.user,
            course: r.course,
          },
        ]
      : [],
  )
}

// ============================================
// STEP 3 — MEMBERS LIST + MEMBER DETAIL
// ============================================

export interface MemberListFilters {
  search?: string
  /** ALL = both MEMBER and TEAM; admins are excluded from this surface. */
  role?: 'ALL' | 'MEMBER' | 'TEAM'
}

export type MembersSort = 'recent' | 'progress' | 'enrollments' | 'name'

export interface MemberListRow {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
  role: Role
  totalEnrollments: number
  completedCourses: number
  avgProgressPercent: number
  lastActivity: Date | null
}

export interface MembersListResult {
  rows: MemberListRow[]
  total: number
  page: number
  totalPages: number
}

const MEMBERS_SORTERS: Record<
  MembersSort,
  (a: MemberListRow, b: MemberListRow) => number
> = {
  recent: (a, b) =>
    (b.lastActivity?.getTime() ?? 0) - (a.lastActivity?.getTime() ?? 0),
  progress: (a, b) => b.avgProgressPercent - a.avgProgressPercent,
  enrollments: (a, b) => b.totalEnrollments - a.totalEnrollments,
  name: (a, b) => {
    const an = (a.name ?? a.email).toLowerCase()
    const bn = (b.name ?? b.email).toLowerCase()
    return an.localeCompare(bn)
  },
}

/**
 * Fetch + aggregate every matching user, then sort + paginate in JS.
 * This is fine for the realistic size range (hundreds to a few
 * thousand members); for tens-of-thousands we'd push the aggregation
 * into raw SQL. The aggregated columns (avg progress, last activity)
 * aren't stored on the user row, so a DB-side ORDER BY would either
 * need a materialized view or a complex subquery.
 */
async function fetchMembersWithProgress(
  filters: MemberListFilters,
  sort: MembersSort,
): Promise<MemberListRow[]> {
  const search = filters.search?.trim() ?? ''
  const role = filters.role ?? 'ALL'
  const roleFilter: Role[] =
    role === 'ALL' ? ['MEMBER', 'TEAM'] : [role as Role]

  const users = await prisma.user.findMany({
    where: {
      role: { in: roleFilter },
      deletedAt: null,
      enrollments: { some: {} },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      role: true,
      enrollments: {
        where: { status: { not: 'REVOKED' } },
        select: {
          progressPercent: true,
          completedAt: true,
          lastAccessedAt: true,
        },
      },
    },
  })

  const rows: MemberListRow[] = users.map((u) => {
    const total = u.enrollments.length
    const completed = u.enrollments.filter((e) => e.completedAt).length
    const avg =
      total > 0
        ? Math.round(
            u.enrollments.reduce((s, e) => s + e.progressPercent, 0) / total,
          )
        : 0
    // lastActivity = most recent of (lastAccessedAt, completedAt)
    // across all this user's enrollments. completedAt fills in cases
    // where the member finished but never revisited.
    const lastActivityMs = u.enrollments.reduce<number>((max, e) => {
      const ts = Math.max(
        e.lastAccessedAt?.getTime() ?? 0,
        e.completedAt?.getTime() ?? 0,
      )
      return ts > max ? ts : max
    }, 0)
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      avatarUrl: u.avatarUrl,
      role: u.role,
      totalEnrollments: total,
      completedCourses: completed,
      avgProgressPercent: avg,
      lastActivity: lastActivityMs > 0 ? new Date(lastActivityMs) : null,
    }
  })

  return rows.sort(MEMBERS_SORTERS[sort])
}

async function listMembersWithProgress(
  filters: MemberListFilters = {},
  page = 1,
  limit = 20,
  sort: MembersSort = 'recent',
): Promise<MembersListResult> {
  await requireAdmin()
  const rows = await fetchMembersWithProgress(filters, sort)
  const total = rows.length
  const safePage = Math.max(1, page)
  const safeLimit = Math.max(1, Math.min(100, limit))
  const skip = (safePage - 1) * safeLimit

  return {
    rows: rows.slice(skip, skip + safeLimit),
    total,
    page: safePage,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
  }
}

/** Same filter + sort shape as listMembersWithProgress, no pagination,
 *  formatted as CSV. Capped at CSV_EXPORT_MAX_ROWS with a trailing
 *  truncation marker — same posture as exportCourseCohortCsv. */
async function exportMembersCsv(
  filters: MemberListFilters = {},
  sort: MembersSort = 'recent',
): Promise<string> {
  await requireAdmin()
  const all = await fetchMembersWithProgress(filters, sort)
  const truncated = all.length > CSV_EXPORT_MAX_ROWS
  const safeRows = truncated ? all.slice(0, CSV_EXPORT_MAX_ROWS) : all

  const header = [
    'Name',
    'Email',
    'Role',
    'Total enrollments',
    'Completed courses',
    'Avg progress %',
    'Last activity',
  ]

  const escape = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return ''
    const str = String(value)
    if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`
    return str
  }

  const body = safeRows.map((r) =>
    [
      escape(r.name),
      escape(r.email),
      escape(r.role),
      escape(r.totalEnrollments),
      escape(r.completedCourses),
      escape(r.avgProgressPercent),
      escape(r.lastActivity ? r.lastActivity.toISOString() : ''),
    ].join(','),
  )

  const lines = [header.join(','), ...body]
  if (truncated) {
    lines.push(
      `"[truncated at ${CSV_EXPORT_MAX_ROWS} rows — refine filters to narrow the list]"`,
    )
  }
  return lines.join('\n')
}

export interface MemberEnrollmentRow {
  enrollmentId: string
  courseId: string
  courseTitle: string
  courseThumbnailUrl: string | null
  status: EnrollmentStatus
  source: EnrollmentSource
  progressPercent: number
  enrolledAt: Date
  lastAccessedAt: Date | null
  completedAt: Date | null
}

export interface MemberProgressDetail {
  user: {
    id: string
    name: string | null
    email: string
    avatarUrl: string | null
    role: Role
    isActive: boolean
    createdAt: Date
    lastLoginAt: Date | null
  }
  kpis: {
    totalEnrollments: number
    completedCourses: number
    avgProgressPercent: number
    completedLessonsLast30d: number
  }
  enrollments: MemberEnrollmentRow[]
}

async function getMemberProgress(
  userId: string,
): Promise<MemberProgressDetail | null> {
  await requireAdmin()
  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS)

  const [user, enrollments, completedLast30d] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
      },
    }),
    prisma.enrollment.findMany({
      where: { userId, status: { not: 'REVOKED' } },
      orderBy: { enrolledAt: 'desc' },
      select: {
        id: true,
        status: true,
        source: true,
        progressPercent: true,
        enrolledAt: true,
        lastAccessedAt: true,
        completedAt: true,
        course: {
          select: { id: true, title: true, thumbnailUrl: true },
        },
      },
    }),
    prisma.lessonProgress.count({
      where: {
        userId,
        completed: true,
        completedAt: { gte: thirtyDaysAgo },
      },
    }),
  ])

  if (!user) return null

  const enrollmentRows: MemberEnrollmentRow[] = enrollments.map((e) => ({
    enrollmentId: e.id,
    courseId: e.course.id,
    courseTitle: e.course.title,
    courseThumbnailUrl: e.course.thumbnailUrl,
    status: e.status,
    source: e.source,
    progressPercent: e.progressPercent,
    enrolledAt: e.enrolledAt,
    lastAccessedAt: e.lastAccessedAt,
    completedAt: e.completedAt,
  }))

  const total = enrollmentRows.length
  const completed = enrollmentRows.filter((e) => e.completedAt).length
  const avg =
    total > 0
      ? Math.round(
          enrollmentRows.reduce((s, e) => s + e.progressPercent, 0) / total,
        )
      : 0

  return {
    user,
    kpis: {
      totalEnrollments: total,
      completedCourses: completed,
      avgProgressPercent: avg,
      completedLessonsLast30d: completedLast30d,
    },
    enrollments: enrollmentRows,
  }
}

export interface MemberCourseLesson {
  id: string
  title: string
  type: LessonType
  status: LessonStatus
  completed: boolean
  watchedPercent: number
  completedAt: Date | null
}

export interface MemberCourseChapter {
  id: string
  title: string
  moduleTitle: string | null
  completedLessons: number
  totalLessons: number
  percent: number
  lessons: MemberCourseLesson[]
}

export interface MemberCourseProgress {
  courseId: string
  courseTitle: string
  chapters: MemberCourseChapter[]
}

async function getMemberCourseProgress(
  userId: string,
  courseId: string,
): Promise<MemberCourseProgress | null> {
  await requireAdmin()
  const [course, progressRows] = await Promise.all([
    prisma.course.findUnique({
      where: { id: courseId, deletedAt: null },
      select: {
        id: true,
        title: true,
        chapters: {
          where: { deletedAt: null },
          orderBy: { orderIndex: 'asc' },
          select: {
            id: true,
            title: true,
            module: { select: { title: true } },
            lessons: {
              where: { deletedAt: null },
              orderBy: { orderIndex: 'asc' },
              select: {
                id: true,
                title: true,
                type: true,
                status: true,
              },
            },
          },
        },
      },
    }),
    prisma.lessonProgress.findMany({
      where: {
        userId,
        lesson: { chapter: { courseId } },
      },
      select: {
        lessonId: true,
        completed: true,
        watchedPercent: true,
        completedAt: true,
      },
    }),
  ])

  if (!course) return null

  const progressMap = new Map(progressRows.map((p) => [p.lessonId, p]))

  const chapters: MemberCourseChapter[] = course.chapters.map((ch) => {
    const lessons: MemberCourseLesson[] = ch.lessons.map((l) => {
      const p = progressMap.get(l.id)
      return {
        id: l.id,
        title: l.title,
        type: l.type,
        status: l.status,
        completed: p?.completed ?? false,
        watchedPercent: p?.watchedPercent ?? 0,
        completedAt: p?.completedAt ?? null,
      }
    })
    const completedLessons = lessons.filter((l) => l.completed).length
    const totalLessons = lessons.length
    const percent =
      totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0
    return {
      id: ch.id,
      title: ch.title,
      moduleTitle: ch.module?.title ?? null,
      completedLessons,
      totalLessons,
      percent,
      lessons,
    }
  })

  return {
    courseId: course.id,
    courseTitle: course.title,
    chapters,
  }
}

// ============================================
// STEP 4 — COURSES LIST + COHORT + CSV EXPORT
// ============================================

export interface CourseListRow {
  id: string
  title: string
  thumbnailUrl: string | null
  status: CourseStatus
  enrolledCount: number
  activeCount: number
  completedCount: number
  avgProgressPercent: number
  completionRate: number
}

async function listCoursesWithProgress(): Promise<CourseListRow[]> {
  await requireAdmin()
  const courses = await prisma.course.findMany({
    where: { deletedAt: null },
    orderBy: { orderIndex: 'asc' },
    select: {
      id: true,
      title: true,
      thumbnailUrl: true,
      status: true,
      enrollments: {
        where: { status: { not: 'REVOKED' } },
        select: {
          status: true,
          progressPercent: true,
          completedAt: true,
        },
      },
    },
  })

  return courses.map((c) => {
    const enrolled = c.enrollments.length
    const active = c.enrollments.filter(
      (e) => e.status === 'ACTIVE' && !e.completedAt,
    ).length
    const completed = c.enrollments.filter((e) => e.completedAt).length
    const avg =
      enrolled > 0
        ? Math.round(
            c.enrollments.reduce((s, e) => s + e.progressPercent, 0) /
              enrolled,
          )
        : 0
    const completionRate =
      enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0
    return {
      id: c.id,
      title: c.title,
      thumbnailUrl: c.thumbnailUrl,
      status: c.status,
      enrolledCount: enrolled,
      activeCount: active,
      completedCount: completed,
      avgProgressPercent: avg,
      completionRate,
    }
  })
}

export interface CourseProgressSummary {
  course: {
    id: string
    title: string
    thumbnailUrl: string | null
    status: CourseStatus
  }
  kpis: {
    enrolled: number
    active: number
    completed: number
    avgProgressPercent: number
    completionRate: number
    /** Distinct users with lastAccessedAt in the last 7 days. */
    weeklyActive: number
  }
}

async function getCourseProgressSummary(
  courseId: string,
): Promise<CourseProgressSummary | null> {
  await requireAdmin()
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS)

  const [
    course,
    nonRevoked,
    active,
    completed,
    progressAgg,
    weeklyActiveRows,
  ] = await Promise.all([
    prisma.course.findUnique({
      where: { id: courseId, deletedAt: null },
      select: {
        id: true,
        title: true,
        thumbnailUrl: true,
        status: true,
      },
    }),
    prisma.enrollment.count({
      where: { courseId, status: { not: 'REVOKED' } },
    }),
    prisma.enrollment.count({
      where: { courseId, status: 'ACTIVE', completedAt: null },
    }),
    prisma.enrollment.count({
      where: { courseId, completedAt: { not: null } },
    }),
    prisma.enrollment.aggregate({
      where: { courseId, status: { not: 'REVOKED' } },
      _avg: { progressPercent: true },
    }),
    prisma.enrollment.findMany({
      where: { courseId, lastAccessedAt: { gte: sevenDaysAgo } },
      select: { userId: true },
      distinct: ['userId'],
    }),
  ])

  if (!course) return null

  return {
    course,
    kpis: {
      enrolled: nonRevoked,
      active,
      completed,
      avgProgressPercent: Math.round(progressAgg._avg.progressPercent ?? 0),
      completionRate:
        nonRevoked > 0 ? Math.round((completed / nonRevoked) * 100) : 0,
      weeklyActive: weeklyActiveRows.length,
    },
  }
}

export interface CohortFilters {
  search?: string
  role?: 'ALL' | 'MEMBER' | 'TEAM'
  /** ACTIVE = in progress; COMPLETED = completedAt set; EXPIRED = expired. */
  status?: 'ALL' | 'ACTIVE' | 'COMPLETED' | 'EXPIRED'
}

export interface CohortRow {
  enrollmentId: string
  user: {
    id: string
    name: string | null
    email: string
    avatarUrl: string | null
    role: Role
  }
  status: EnrollmentStatus
  source: EnrollmentSource
  progressPercent: number
  enrolledAt: Date
  lastAccessedAt: Date | null
  completedAt: Date | null
}

export interface CohortResult {
  rows: CohortRow[]
  total: number
  page: number
  totalPages: number
}

/**
 * Build the Prisma where-clause shared by getCourseCohort and
 * exportCourseCohortCsv. Centralising it keeps the export and the
 * paginated view in sync — whatever the operator sees on screen is
 * exactly what they download.
 */
function buildCohortWhere(
  courseId: string,
  filters: CohortFilters,
): Prisma.EnrollmentWhereInput {
  const search = filters.search?.trim() ?? ''
  const role = filters.role ?? 'ALL'
  const status = filters.status ?? 'ALL'
  const roleFilter: Role[] =
    role === 'ALL' ? ['MEMBER', 'TEAM'] : [role as Role]

  const where: Prisma.EnrollmentWhereInput = {
    courseId,
    status: { not: 'REVOKED' },
    user: {
      role: { in: roleFilter },
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
  }

  if (status === 'ACTIVE') {
    where.status = 'ACTIVE'
    where.completedAt = null
  } else if (status === 'COMPLETED') {
    where.completedAt = { not: null }
  } else if (status === 'EXPIRED') {
    where.status = 'EXPIRED'
  }

  return where
}

const COHORT_SELECT = {
  id: true,
  status: true,
  source: true,
  progressPercent: true,
  enrolledAt: true,
  lastAccessedAt: true,
  completedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      role: true,
    },
  },
} satisfies Prisma.EnrollmentSelect

export type CohortSort = 'progress' | 'enrolled' | 'lastAccess' | 'name'

function cohortOrderBy(
  sort: CohortSort,
): Prisma.EnrollmentOrderByWithRelationInput[] {
  switch (sort) {
    case 'enrolled':
      return [{ enrolledAt: 'desc' }]
    case 'lastAccess':
      // Members who haven't started yet (null lastAccessedAt) belong at
      // the bottom of a "most-recent-access-first" sort, not the top.
      return [
        { lastAccessedAt: { sort: 'desc', nulls: 'last' } },
        { enrolledAt: 'desc' },
      ]
    case 'name':
      return [
        { user: { name: { sort: 'asc', nulls: 'last' } } },
        { user: { email: 'asc' } },
      ]
    case 'progress':
    default:
      return [{ progressPercent: 'desc' }, { enrolledAt: 'desc' }]
  }
}

async function getCourseCohort(
  courseId: string,
  filters: CohortFilters,
  page: number,
  limit: number,
  sort: CohortSort = 'progress',
): Promise<CohortResult> {
  await requireAdmin()
  const where = buildCohortWhere(courseId, filters)
  const safePage = Math.max(1, page)
  const safeLimit = Math.max(1, Math.min(100, limit))

  const [rows, total] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      orderBy: cohortOrderBy(sort),
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
      select: COHORT_SELECT,
    }),
    prisma.enrollment.count({ where }),
  ])

  return {
    rows: rows.map((r) => ({
      enrollmentId: r.id,
      user: r.user,
      status: r.status,
      source: r.source,
      progressPercent: r.progressPercent,
      enrolledAt: r.enrolledAt,
      lastAccessedAt: r.lastAccessedAt,
      completedAt: r.completedAt,
    })),
    total,
    page: safePage,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
  }
}

/**
 * Same filter shape as getCourseCohort but no pagination — pulls the
 * filtered list and formats it as CSV. Caller is expected to set the
 * Content-Disposition header for download.
 *
 * Hard-capped at CSV_EXPORT_MAX_ROWS rows so a 50k-cohort doesn't
 * blow the response timeout / memory. The truncated row appears as a
 * trailing pseudo-row in the CSV so the operator knows the dump was
 * partial — easier to spot than a silently-clipped file.
 */
async function exportCourseCohortCsv(
  courseId: string,
  filters: CohortFilters,
  sort: CohortSort = 'progress',
): Promise<string> {
  await requireAdmin()
  const where = buildCohortWhere(courseId, filters)

  const rows = await prisma.enrollment.findMany({
    where,
    orderBy: cohortOrderBy(sort),
    take: CSV_EXPORT_MAX_ROWS + 1,
    select: COHORT_SELECT,
  })
  const truncated = rows.length > CSV_EXPORT_MAX_ROWS
  const safeRows = truncated ? rows.slice(0, CSV_EXPORT_MAX_ROWS) : rows

  const header = [
    'Name',
    'Email',
    'Role',
    'Status',
    'Progress %',
    'Enrolled at',
    'Last accessed',
    'Completed at',
    'Source',
  ]

  const escape = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return ''
    const str = String(value)
    // RFC 4180 — wrap in double quotes if the field has a comma, newline,
    // or double quote. Escape embedded double quotes by doubling them.
    if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`
    return str
  }

  const iso = (date: Date | null) => (date ? date.toISOString() : '')

  const body = safeRows.map((r) =>
    [
      escape(r.user.name),
      escape(r.user.email),
      escape(r.user.role),
      escape(r.completedAt ? 'COMPLETED' : r.status),
      escape(r.progressPercent),
      escape(iso(r.enrolledAt)),
      escape(iso(r.lastAccessedAt)),
      escape(iso(r.completedAt)),
      escape(r.source),
    ].join(','),
  )

  const lines = [header.join(','), ...body]
  if (truncated) {
    // Visible marker so the operator can see the dump was clipped at
    // CSV_EXPORT_MAX_ROWS rather than legitimately ending here.
    lines.push(
      `"[truncated at ${CSV_EXPORT_MAX_ROWS} rows — refine filters to narrow the cohort]"`,
    )
  }
  return lines.join('\n')
}

export const adminProgressService = {
  getOverviewKpis,
  getMostEngagedMembers,
  getTopCourses,
  getRecentCompletions,
  listMembersWithProgress,
  exportMembersCsv,
  getMemberProgress,
  getMemberCourseProgress,
  listCoursesWithProgress,
  getCourseProgressSummary,
  getCourseCohort,
  exportCourseCohortCsv,
}

import type {
  CourseStatus,
  EnrollmentSource,
  EnrollmentStatus,
  LessonStatus,
  LessonType,
  Prisma,
  Role,
} from '@prisma/client'

import { prisma } from '@/lib/prisma'

// Admin-only progress aggregation. Surfaces under /admin/progress/*
// read from here, not from member-course-service (which is scoped to
// the signed-in user's own data). Every method assumes the caller has
// already cleared the admin gate via requireAdmin().
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

// ============================================
// STEP 2 — OVERVIEW
// ============================================

export interface OverviewKpis {
  /** Members + Team users that are active (excludes deleted/disabled). */
  activeMembers: number
  /** Non-revoked enrollments (ACTIVE + EXPIRED + completed). */
  totalEnrollments: number
  /** Average progress across ACTIVE enrollments, 0-100. */
  avgProgressPercent: number
  /** Completed / non-revoked enrollments, 0-100. */
  completionRate: number
  /** Distinct users whose `lastAccessedAt` falls in the last 7 days. */
  weeklyActiveLearners: number
}

async function getOverviewKpis(): Promise<OverviewKpis> {
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS)

  const [
    activeMembers,
    nonRevokedTotal,
    completedTotal,
    progressAgg,
    weeklyActiveRows,
  ] = await Promise.all([
    prisma.user.count({
      where: {
        role: { in: ['MEMBER', 'TEAM'] },
        isActive: true,
        deletedAt: null,
      },
    }),
    prisma.enrollment.count({
      where: { status: { not: 'REVOKED' } },
    }),
    prisma.enrollment.count({
      where: { completedAt: { not: null } },
    }),
    prisma.enrollment.aggregate({
      where: { status: 'ACTIVE' },
      _avg: { progressPercent: true },
    }),
    prisma.enrollment.findMany({
      where: { lastAccessedAt: { gte: sevenDaysAgo } },
      select: { userId: true },
      distinct: ['userId'],
    }),
  ])

  return {
    activeMembers,
    totalEnrollments: nonRevokedTotal,
    avgProgressPercent: Math.round(progressAgg._avg.progressPercent ?? 0),
    completionRate:
      nonRevokedTotal > 0
        ? Math.round((completedTotal / nonRevokedTotal) * 100)
        : 0,
    weeklyActiveLearners: weeklyActiveRows.length,
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
  /** Most recent completion timestamp (last 30 days only). */
  lastActivity: Date | null
}

async function getMostEngagedMembers(limit = 5): Promise<EngagedMember[]> {
  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS)

  const grouped = await prisma.lessonProgress.groupBy({
    by: ['userId'],
    where: {
      completed: true,
      completedAt: { gte: thirtyDaysAgo },
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

async function getTopCourses(limit = 5): Promise<TopCourseItem[]> {
  // Rank courses by total enrollments (non-revoked). Pulls top N then
  // fetches course meta + completion counts in parallel.
  const grouped = await prisma.enrollment.groupBy({
    by: ['courseId'],
    where: { status: { not: 'REVOKED' } },
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
      where: { courseId: { in: courseIds }, completedAt: { not: null } },
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

async function getRecentCompletions(limit = 10): Promise<RecentCompletion[]> {
  const rows = await prisma.enrollment.findMany({
    where: { completedAt: { not: null } },
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

async function listMembersWithProgress(
  filters: MemberListFilters = {},
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

  return users
    .map((u) => {
      const total = u.enrollments.length
      const completed = u.enrollments.filter((e) => e.completedAt).length
      const avg =
        total > 0
          ? Math.round(
              u.enrollments.reduce((s, e) => s + e.progressPercent, 0) / total,
            )
          : 0
      // lastActivity = most recent of (lastAccessedAt, completedAt) across
      // all this user's enrollments. completedAt fills in cases where the
      // member finished a course but never came back to revisit it.
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
    .sort((a, b) => {
      // Most recently active first; nulls go to the bottom.
      const aMs = a.lastActivity?.getTime() ?? 0
      const bMs = b.lastActivity?.getTime() ?? 0
      return bMs - aMs
    })
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

async function getCourseCohort(
  courseId: string,
  filters: CohortFilters,
  page: number,
  limit: number,
): Promise<CohortResult> {
  const where = buildCohortWhere(courseId, filters)
  const safePage = Math.max(1, page)
  const safeLimit = Math.max(1, Math.min(100, limit))

  const [rows, total] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      orderBy: [{ progressPercent: 'desc' }, { enrolledAt: 'desc' }],
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
 * full filtered list and formats it as CSV. Caller is expected to set
 * the Content-Disposition header for download.
 */
async function exportCourseCohortCsv(
  courseId: string,
  filters: CohortFilters,
): Promise<string> {
  const where = buildCohortWhere(courseId, filters)

  const rows = await prisma.enrollment.findMany({
    where,
    orderBy: [{ progressPercent: 'desc' }, { enrolledAt: 'desc' }],
    select: COHORT_SELECT,
  })

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

  const body = rows.map((r) =>
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

  return [header.join(','), ...body].join('\n')
}

export const adminProgressService = {
  getOverviewKpis,
  getMostEngagedMembers,
  getTopCourses,
  getRecentCompletions,
  listMembersWithProgress,
  getMemberProgress,
  getMemberCourseProgress,
  listCoursesWithProgress,
  getCourseProgressSummary,
  getCourseCohort,
  exportCourseCohortCsv,
}

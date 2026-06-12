import type { Role } from '@prisma/client'

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

export const adminProgressService = {
  getOverviewKpis,
  getMostEngagedMembers,
  getTopCourses,
  getRecentCompletions,
}

import { prisma } from '@/lib/prisma'

// ============================================
// MEMBER-SIDE COURSE QUERIES
// ============================================
//
// The admin course-service surfaces everything an admin can manage,
// including drafts, internal courses, soft-deleted rows, etc.
// This file is the parallel for members: it never returns anything a
// member shouldn't see, and folds in the current user's enrollment
// + progress so the UI doesn't need a second roundtrip.

// audience MEMBERS or BOTH is what members are allowed to discover.
const MEMBER_VISIBLE_AUDIENCE = ['MEMBERS', 'BOTH'] as const

// ============================================
// LIST — catalog grid
// ============================================

const catalogSelect = {
  id: true,
  title: true,
  description: true,
  thumbnailUrl: true,
  coverImageUrl: true,
  status: true,
  audience: true,
  isFree: true,
  accessDays: true,
  publishedAt: true,
  // Counts + per-lesson duration so the card can show "X lessons · Yh Zm"
  // without a second roundtrip.
  _count: { select: { chapters: true } },
  chapters: {
    where: { deletedAt: null },
    select: {
      lessons: {
        where: { deletedAt: null },
        select: { durationSeconds: true },
      },
    },
  },
} as const

export async function listCatalogForMember(userId: string) {
  const rows = await prisma.course.findMany({
    where: {
      deletedAt: null,
      status: 'PUBLISHED',
      audience: { in: [...MEMBER_VISIBLE_AUDIENCE] },
    },
    orderBy: { orderIndex: 'asc' },
    select: catalogSelect,
  })

  // One round-trip for the member's enrollments + progress aggregates.
  // We could pull this with a relation include, but a flat fetch by
  // courseId set is simpler and avoids re-querying soft-deleted rows.
  const courseIds = rows.map((r) => r.id)
  const [enrollments, progressGroups] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId, courseId: { in: courseIds } },
      select: {
        courseId: true,
        status: true,
        progressPercent: true,
        enrolledAt: true,
        lastAccessedAt: true,
      },
    }),
    prisma.lessonProgress.groupBy({
      by: ['lessonId'],
      where: {
        userId,
        completed: true,
        lesson: { chapter: { courseId: { in: courseIds } } },
      },
      _count: { _all: true },
    }),
  ])

  // Map enrollments by courseId for lookup.
  const enrollmentByCourse = new Map(
    enrollments.map((e) => [e.courseId, e]),
  )
  // We only need the count of completed lessons per course, so reduce
  // the progress group results to a single count per course. Doing
  // this in Prisma directly would mean a more complex aggregate that
  // joins enrollment → course; the JS reduce is cheap here.
  const completedLessonsByCourse = new Map<string, number>()

  // Cross-join completed-lesson ids with course tree to count per course.
  // We need a flat list of (courseId, lessonId) — fetch separately to
  // avoid pulling every lesson row.
  if (progressGroups.length > 0) {
    const lessonToCourse = await prisma.lesson.findMany({
      where: { id: { in: progressGroups.map((g) => g.lessonId) } },
      select: { id: true, chapter: { select: { courseId: true } } },
    })
    for (const l of lessonToCourse) {
      const cid = l.chapter.courseId
      completedLessonsByCourse.set(
        cid,
        (completedLessonsByCourse.get(cid) ?? 0) + 1,
      )
    }
  }

  return rows.map((row) => {
    const { chapters, _count, ...rest } = row
    const allLessons = chapters.flatMap((c) => c.lessons)
    const lessonsTotal = allLessons.length
    const durationSeconds = allLessons.reduce(
      (sum, l) => sum + (l.durationSeconds ?? 0),
      0,
    )
    const enrollment = enrollmentByCourse.get(row.id) ?? null
    const completedLessons = completedLessonsByCourse.get(row.id) ?? 0
    return {
      ...rest,
      chaptersCount: _count.chapters,
      lessonsCount: lessonsTotal,
      durationSeconds,
      enrollment,
      progress:
        lessonsTotal > 0
          ? {
              completed: completedLessons,
              total: lessonsTotal,
              percent: Math.round((completedLessons / lessonsTotal) * 100),
            }
          : null,
    }
  })
}

export type MemberCatalogCourse = Awaited<
  ReturnType<typeof listCatalogForMember>
>[number]

// ============================================
// DETAIL — single course with curriculum + per-lesson progress overlay
// ============================================

const detailSelect = {
  id: true,
  title: true,
  description: true,
  thumbnailUrl: true,
  coverImageUrl: true,
  status: true,
  audience: true,
  isFree: true,
  accessDays: true,
  publishedAt: true,
  chapters: {
    where: { deletedAt: null },
    orderBy: { orderIndex: 'asc' as const },
    select: {
      id: true,
      title: true,
      orderIndex: true,
      lessons: {
        where: { deletedAt: null },
        orderBy: { orderIndex: 'asc' as const },
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          orderIndex: true,
          durationSeconds: true,
        },
      },
    },
  },
} as const

export async function getCourseForMember(userId: string, courseId: string) {
  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      deletedAt: null,
      status: 'PUBLISHED',
      audience: { in: [...MEMBER_VISIBLE_AUDIENCE] },
    },
    select: detailSelect,
  })
  if (!course) return null

  // Per-lesson progress overlay.
  const lessonIds = course.chapters.flatMap((c) =>
    c.lessons.map((l) => l.id),
  )
  const [enrollment, progress] = await Promise.all([
    prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: {
        id: true,
        status: true,
        progressPercent: true,
        enrolledAt: true,
        lastAccessedAt: true,
        expiresAt: true,
      },
    }),
    lessonIds.length > 0
      ? prisma.lessonProgress.findMany({
          where: { userId, lessonId: { in: lessonIds } },
          select: {
            lessonId: true,
            completed: true,
            completedAt: true,
            watchedPercent: true,
            lastPositionSec: true,
            updatedAt: true,
          },
        })
      : Promise.resolve([]),
  ])
  const progressByLesson = new Map(progress.map((p) => [p.lessonId, p]))

  const chapters = course.chapters.map((c) => ({
    ...c,
    lessons: c.lessons.map((l) => ({
      ...l,
      progress: progressByLesson.get(l.id) ?? null,
    })),
  }))
  const lessonsTotal = lessonIds.length
  const completedLessons = progress.filter((p) => p.completed).length

  return {
    ...course,
    chapters,
    enrollment,
    lessonsCount: lessonsTotal,
    completedLessons,
    progressPercent:
      lessonsTotal > 0
        ? Math.round((completedLessons / lessonsTotal) * 100)
        : 0,
  }
}

export type MemberCourseDetail = NonNullable<
  Awaited<ReturnType<typeof getCourseForMember>>
>

// ============================================
// ENROLLMENT — auto-create on first access
// ============================================

/**
 * Idempotent upsert: if the user is already enrolled (active or
 * otherwise), bump lastAccessedAt and return. If not, create a fresh
 * ACTIVE enrollment. Treats every member-visible course the same way
 * — the isFree distinction is honored at the catalog level (this
 * function doesn't need to gate). Paid integrations land in Sprint 5+.
 */
export async function ensureEnrollment(userId: string, courseId: string) {
  // Confirm the course is actually visible to this member before we
  // create a row.
  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      deletedAt: null,
      status: 'PUBLISHED',
      audience: { in: [...MEMBER_VISIBLE_AUDIENCE] },
    },
    select: { id: true, accessDays: true },
  })
  if (!course) return null

  const expiresAt = course.accessDays
    ? new Date(Date.now() + course.accessDays * 24 * 60 * 60 * 1000)
    : null

  return prisma.enrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: {
      userId,
      courseId,
      status: 'ACTIVE',
      source: 'SELF_ENROLL',
      lastAccessedAt: new Date(),
      expiresAt,
    },
    update: { lastAccessedAt: new Date() },
    select: { id: true, status: true },
  })
}

export const memberCourseService = {
  listCatalog: listCatalogForMember,
  getById: getCourseForMember,
  ensureEnrollment,
}

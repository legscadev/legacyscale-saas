import type { CourseAudience, Role } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { visibleAudiencesFor } from '@/lib/auth/permissions'

const RESOURCE_BUCKET = 'lesson-resources'
const SIGNED_URL_TTL_SEC = 60 * 5 // 5 minutes — plenty for a click-to-download

// ============================================
// MEMBER-SIDE COURSE QUERIES
// ============================================
//
// The admin course-service surfaces everything an admin can manage,
// including drafts, internal courses, soft-deleted rows, etc.
// This file is the parallel for members: it never returns anything a
// member shouldn't see, and folds in the current user's enrollment
// + progress so the UI doesn't need a second roundtrip.
//
// Audience visibility now depends on the user's Role: MEMBER sees
// MEMBERS+BOTH; TEAM and ADMIN also see INTERNAL. Methods that filter
// by audience accept the role explicitly OR look it up.

async function resolveVisibleAudiences(
  userId: string,
): Promise<CourseAudience[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  return visibleAudiencesFor(user?.role ?? ('MEMBER' as Role))
}

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
  const visibleAudiences = await resolveVisibleAudiences(userId)
  const rows = await prisma.course.findMany({
    where: {
      deletedAt: null,
      status: 'PUBLISHED',
      audience: { in: visibleAudiences },
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
          description: true,
          type: true,
          status: true,
          orderIndex: true,
          durationSeconds: true,
          muxPlaybackId: true,
          // Quiz config (visible to members; correctIndex stays
          // server-side and is consulted in submitQuizAttempt).
          passingScore: true,
          maxAttempts: true,
          timeLimitMin: true,
          quizQuestions: {
            orderBy: { orderIndex: 'asc' as const },
            select: {
              id: true,
              questionText: true,
              type: true,
              options: true,
              orderIndex: true,
            },
          },
          resources: {
            orderBy: { createdAt: 'asc' as const },
            select: {
              id: true,
              name: true,
              size: true,
              mimeType: true,
            },
          },
        },
      },
    },
  },
} as const

export async function getCourseForMember(userId: string, courseId: string) {
  const visibleAudiences = await resolveVisibleAudiences(userId)
  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      deletedAt: null,
      status: 'PUBLISHED',
      audience: { in: visibleAudiences },
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
  const visibleAudiences = await resolveVisibleAudiences(userId)
  // Confirm the course is actually visible to this member before we
  // create a row.
  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      deletedAt: null,
      status: 'PUBLISHED',
      audience: { in: visibleAudiences },
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

// ============================================
// PROGRESS — mark a lesson complete (or undo)
// ============================================

/**
 * Idempotent upsert of LessonProgress for the given user + lesson.
 * Always returns the updated course-level progress percent so the
 * caller can revalidate UI without a second roundtrip.
 *
 * Throws if the lesson doesn't belong to a member-visible course.
 */
export async function markLessonProgress(
  userId: string,
  lessonId: string,
  completed: boolean,
) {
  // Look up the lesson + course so we can authz and aggregate.
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, deletedAt: null },
    select: {
      id: true,
      chapter: {
        select: {
          courseId: true,
          course: {
            select: {
              id: true,
              status: true,
              audience: true,
              deletedAt: true,
            },
          },
        },
      },
    },
  })
  if (!lesson) throw new Error('Lesson not found')

  const course = lesson.chapter.course
  const visibleAudiences = await resolveVisibleAudiences(userId)
  if (
    !course ||
    course.deletedAt !== null ||
    course.status !== 'PUBLISHED' ||
    !visibleAudiences.includes(course.audience)
  ) {
    throw new Error('Lesson not accessible')
  }

  // Make sure the user has an enrollment row; lastAccessedAt bump is
  // a nice side effect for the "Continue learning" hero.
  await ensureEnrollment(userId, course.id)

  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: {
      userId,
      lessonId,
      completed,
      completedAt: completed ? new Date() : null,
    },
    update: {
      completed,
      completedAt: completed ? new Date() : null,
    },
  })

  // Recompute overall % for this course.
  const [lessonsTotal, completedCount] = await Promise.all([
    prisma.lesson.count({
      where: { chapter: { courseId: course.id }, deletedAt: null },
    }),
    prisma.lessonProgress.count({
      where: {
        userId,
        completed: true,
        lesson: { chapter: { courseId: course.id }, deletedAt: null },
      },
    }),
  ])
  const progressPercent =
    lessonsTotal > 0 ? Math.round((completedCount / lessonsTotal) * 100) : 0

  // Keep the cached enrollment.progressPercent in sync so the catalog
  // hero is accurate without re-aggregating per render.
  await prisma.enrollment.updateMany({
    where: { userId, courseId: course.id },
    data: { progressPercent },
  })

  return { courseId: course.id, progressPercent, completedCount, lessonsTotal }
}

// ============================================
// LESSON VIEW — touch on every render
// ============================================

/**
 * Side effects that the lesson page kicks off on each render so the
 * resume picker has fresh "where did I leave off" data:
 *  - Touches the user's LessonProgress row for this lesson, creating
 *    it if missing. Bumps watchCount so updatedAt advances on every
 *    visit — that's how the resume picker finds "most recent."
 *  - Bumps the parent enrollment's lastAccessedAt so the catalog's
 *    "Continue learning" hero reflects the right course.
 *
 * Idempotent and safe to fire-and-forget via `after()`.
 */
export async function recordLessonView(userId: string, lessonId: string) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, deletedAt: null },
    select: { id: true, chapter: { select: { courseId: true } } },
  })
  if (!lesson) return

  await Promise.all([
    prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: {
        userId,
        lessonId,
        completed: false,
        watchCount: 1,
      },
      update: { watchCount: { increment: 1 } },
    }),
    // updateMany is intentional: stays a no-op if the user has no
    // enrollment yet (URL deep-link before clicking "Start"). The
    // first real start-course click materializes the row.
    prisma.enrollment.updateMany({
      where: { userId, courseId: lesson.chapter.courseId },
      data: { lastAccessedAt: new Date() },
    }),
  ])
}

// ============================================
// QUIZ — submit attempt, score server-side
// ============================================

interface QuizBreakdownItem {
  questionId: string
  selected: number | null
  correctIndex: number
  explanation: string | null
}

interface QuizSubmissionResult {
  attemptId: string
  passed: boolean
  score: number
  total: number
  passingScore: number
  breakdown: QuizBreakdownItem[]
}

/**
 * Score a quiz attempt server-side and persist it. Never trust the
 * client's score — we look up correctIndex here and tally.
 *
 * Auto-marks the lesson complete if the user passed.
 */
export async function submitQuizAttempt(
  userId: string,
  lessonId: string,
  answers: Record<string, number>,
): Promise<QuizSubmissionResult> {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, deletedAt: null, type: 'QUIZ' },
    select: {
      id: true,
      passingScore: true,
      chapter: {
        select: {
          courseId: true,
          course: {
            select: {
              status: true,
              audience: true,
              deletedAt: true,
            },
          },
        },
      },
      quizQuestions: {
        orderBy: { orderIndex: 'asc' },
        select: { id: true, correctIndex: true, explanation: true },
      },
    },
  })
  if (!lesson) throw new Error('Quiz not found')

  const course = lesson.chapter.course
  const visibleAudiences = await resolveVisibleAudiences(userId)
  if (
    !course ||
    course.deletedAt !== null ||
    course.status !== 'PUBLISHED' ||
    !visibleAudiences.includes(course.audience)
  ) {
    throw new Error('Quiz not accessible')
  }
  if (lesson.quizQuestions.length === 0) {
    throw new Error('Quiz has no questions yet')
  }

  const breakdown: QuizBreakdownItem[] = lesson.quizQuestions.map((q) => ({
    questionId: q.id,
    selected: answers[q.id] ?? null,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
  }))
  const score = breakdown.filter((b) => b.selected === b.correctIndex).length
  const total = breakdown.length
  const pct = Math.round((score / total) * 100)
  const passingScore = lesson.passingScore ?? 70
  const passed = pct >= passingScore

  const attempt = await prisma.quizAttempt.create({
    data: {
      userId,
      lessonId,
      score,
      total,
      passed,
      answers,
    },
    select: { id: true },
  })

  if (passed) {
    await markLessonProgress(userId, lessonId, true)
  }

  return {
    attemptId: attempt.id,
    passed,
    score,
    total,
    passingScore,
    breakdown,
  }
}

// ============================================
// RESOURCES — signed-URL download
// ============================================

/**
 * Returns a short-lived signed URL for a resource attached to a
 * lesson in a member-visible course. Throws if the user shouldn't
 * have access to the parent course.
 */
export async function getResourceDownloadUrl(
  userId: string,
  resourceId: string,
): Promise<{ url: string; filename: string }> {
  const resource = await prisma.lessonResource.findUnique({
    where: { id: resourceId },
    select: {
      id: true,
      name: true,
      path: true,
      lesson: {
        select: {
          deletedAt: true,
          chapter: {
            select: {
              course: {
                select: {
                  status: true,
                  audience: true,
                  deletedAt: true,
                },
              },
            },
          },
        },
      },
    },
  })
  if (!resource || resource.lesson.deletedAt) {
    throw new Error('Resource not found')
  }
  const course = resource.lesson.chapter.course
  const visibleAudiences = await resolveVisibleAudiences(userId)
  if (
    course.deletedAt !== null ||
    course.status !== 'PUBLISHED' ||
    !visibleAudiences.includes(course.audience)
  ) {
    throw new Error('Resource not accessible')
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.storage
    .from(RESOURCE_BUCKET)
    .createSignedUrl(resource.path, SIGNED_URL_TTL_SEC, {
      download: resource.name,
    })
  if (error || !data?.signedUrl) {
    throw new Error('Could not generate download link')
  }
  return { url: data.signedUrl, filename: resource.name }
}

// ============================================
// PROGRESS — track video position for resume
// ============================================

/**
 * Persists the user's current playback position so a refresh /
 * revisit can resume mid-video. Idempotent and intentionally
 * silent: never throws, never revalidates — the read side only
 * runs at page load, so chatty re-renders would be wasted.
 */
export async function updateLessonPosition(
  userId: string,
  lessonId: string,
  positionSec: number,
): Promise<void> {
  if (!Number.isFinite(positionSec) || positionSec < 0) return
  const seconds = Math.floor(positionSec)
  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: {
      userId,
      lessonId,
      completed: false,
      lastPositionSec: seconds,
    },
    update: { lastPositionSec: seconds },
  })
}

export const memberCourseService = {
  listCatalog: listCatalogForMember,
  getById: getCourseForMember,
  ensureEnrollment,
  markLessonProgress,
  recordLessonView,
  submitQuizAttempt,
  getResourceDownloadUrl,
  updateLessonPosition,
}

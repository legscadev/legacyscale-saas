import type { AnnouncementCategory } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import {
  memberCourseService,
  type MemberCatalogCourse,
} from './member-course-service'
import { pickResumeLesson } from './resume-picker'

const CONTINUE_LIST_LIMIT = 6
const ANNOUNCEMENT_LIMIT = 5
const RECENT_NOTES_LIMIT = 4
const RECENT_CERTS_LIMIT = 3

export interface DashboardStats {
  enrolledCount: number
  lessonsCompleted: number
  notesCount: number
  /** Distinct certificates the member has earned (excludes revoked). */
  certificatesEarned: number
}

export interface DashboardRecentNote {
  id: string
  preview: string
  lessonId: string
  lessonTitle: string
  courseSlug: string
  courseTitle: string
  updatedAt: Date
}

export interface DashboardCertificate {
  id: string
  courseTitle: string
  courseSlug: string
  issuedAt: Date
}

export interface DashboardContinueLearning {
  courseId: string
  courseSlug: string
  courseTitle: string
  courseThumbnailUrl: string | null
  progressPercent: number
  resumeLessonId: string | null
  resumeHref: string
}

export interface DashboardAnnouncement {
  id: string
  title: string
  body: string
  category: AnnouncementCategory
  pinned: boolean
  publishedAt: Date | null
  createdAt: Date
  isUnread: boolean
}

export interface MemberDashboard {
  stats: DashboardStats
  continueLearning: DashboardContinueLearning | null
  inProgressCourses: MemberCatalogCourse[]
  announcements: DashboardAnnouncement[]
  recentNotes: DashboardRecentNote[]
  recentCertificates: DashboardCertificate[]
}

async function getStats(userId: string): Promise<DashboardStats> {
  const [enrolledCount, lessonsCompleted, notesCount, certificatesEarned] =
    await Promise.all([
      prisma.enrollment.count({
        where: { userId, status: { in: ['ACTIVE', 'COMPLETED'] } },
      }),
      prisma.lessonProgress.count({ where: { userId, completed: true } }),
      prisma.note.count({ where: { userId } }),
      prisma.certificateIssuance.count({
        where: { userId, revokedAt: null },
      }),
    ])
  return { enrolledCount, lessonsCompleted, notesCount, certificatesEarned }
}

/** Pull the most recently touched notes plus their course/lesson
 *  context so the dashboard can link back to where the note lives.
 *  Preview strips the note body to the first 140 chars — the full
 *  note stays inside the lesson player. */
async function getRecentNotes(
  userId: string,
  limit: number,
): Promise<DashboardRecentNote[]> {
  const rows = await prisma.note.findMany({
    where: { userId, content: { not: '' } },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      content: true,
      updatedAt: true,
      lessonId: true,
      lesson: {
        select: {
          title: true,
          chapter: {
            select: {
              course: { select: { slug: true, title: true } },
            },
          },
        },
      },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    lessonId: r.lessonId,
    lessonTitle: r.lesson.title,
    courseSlug: r.lesson.chapter.course.slug,
    courseTitle: r.lesson.chapter.course.title,
    preview: r.content.slice(0, 140).trim(),
    updatedAt: r.updatedAt,
  }))
}

/** Most recently issued (not revoked) certificates for the badge
 *  row on the dashboard. Full history stays on /certificates. */
async function getRecentCertificates(
  userId: string,
  limit: number,
): Promise<DashboardCertificate[]> {
  const rows = await prisma.certificateIssuance.findMany({
    where: { userId, revokedAt: null },
    orderBy: { issuedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      issuedAt: true,
      course: { select: { title: true, slug: true } },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    issuedAt: r.issuedAt,
    courseTitle: r.course.title,
    courseSlug: r.course.slug,
  }))
}

async function getRecentAnnouncements(
  userId: string,
  limit: number,
): Promise<DashboardAnnouncement[]> {
  const items = await prisma.announcement.findMany({
    where: {
      status: 'PUBLISHED',
      deletedAt: null,
      archivedAt: null,
    },
    orderBy: [
      { pinned: 'desc' },
      { publishedAt: { sort: 'desc', nulls: 'last' } },
      { createdAt: 'desc' },
    ],
    take: limit,
    select: {
      id: true,
      title: true,
      body: true,
      category: true,
      pinned: true,
      publishedAt: true,
      createdAt: true,
    },
  })
  if (items.length === 0) return []

  const reads = await prisma.announcementRead.findMany({
    where: { userId, announcementId: { in: items.map((i) => i.id) } },
    select: { announcementId: true },
  })
  const readSet = new Set(reads.map((r) => r.announcementId))
  return items.map((i) => ({ ...i, isUnread: !readSet.has(i.id) }))
}

/**
 * Single round-trip-friendly aggregate that powers the member
 * dashboard. Composes:
 *  - stats counts (enrolled / lessons completed / notes)
 *  - the most-recent ACTIVE enrollment + the specific lesson to resume
 *    on (via pickResumeLesson over the course's flat curriculum)
 *  - up to 6 ACTIVE enrollments for the continue rail (category-gated
 *    via listCatalog, so a member who lost their tier no longer sees
 *    courses they can no longer open)
 *  - top 5 published announcements with an isUnread flag
 */
async function getMemberDashboard(userId: string): Promise<MemberDashboard> {
  const [stats, catalog, announcements, recentNotes, recentCertificates] =
    await Promise.all([
      getStats(userId),
      memberCourseService.listCatalog(userId),
      getRecentAnnouncements(userId, ANNOUNCEMENT_LIMIT),
      getRecentNotes(userId, RECENT_NOTES_LIMIT),
      getRecentCertificates(userId, RECENT_CERTS_LIMIT),
    ])

  const active = catalog.filter((c) => c.enrollment?.status === 'ACTIVE')
  const sortedActive = [...active].sort(
    (a, b) =>
      (b.enrollment?.lastAccessedAt?.getTime() ?? 0) -
      (a.enrollment?.lastAccessedAt?.getTime() ?? 0),
  )

  let continueLearning: DashboardContinueLearning | null = null
  const anchor = sortedActive[0]
  if (anchor) {
    const detail = await memberCourseService.getById(userId, anchor.id)
    if (detail) {
      const flat = detail.chapters.flatMap((c) => c.lessons)
      const resume = pickResumeLesson(flat)
      continueLearning = {
        courseId: detail.id,
        courseSlug: detail.slug,
        courseTitle: detail.title,
        courseThumbnailUrl: detail.thumbnailUrl ?? null,
        progressPercent: detail.progressPercent,
        resumeLessonId: resume?.id ?? null,
        resumeHref: resume
          ? `/courses/${detail.slug}/lessons/${resume.id}`
          : `/courses/${detail.slug}`,
      }
    }
  }

  return {
    stats,
    continueLearning,
    inProgressCourses: sortedActive.slice(0, CONTINUE_LIST_LIMIT),
    announcements,
    recentNotes,
    recentCertificates,
  }
}

export const dashboardService = {
  getMemberDashboard,
}

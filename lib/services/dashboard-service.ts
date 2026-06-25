import type { AnnouncementCategory } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import {
  memberCourseService,
  type MemberCatalogCourse,
} from './member-course-service'
import { pickResumeLesson } from './resume-picker'

const CONTINUE_LIST_LIMIT = 6
const ANNOUNCEMENT_LIMIT = 5

export interface DashboardStats {
  enrolledCount: number
  lessonsCompleted: number
  notesCount: number
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
}

async function getStats(userId: string): Promise<DashboardStats> {
  const [enrolledCount, lessonsCompleted, notesCount] = await Promise.all([
    prisma.enrollment.count({
      where: { userId, status: { in: ['ACTIVE', 'COMPLETED'] } },
    }),
    prisma.lessonProgress.count({ where: { userId, completed: true } }),
    prisma.note.count({ where: { userId } }),
  ])
  return { enrolledCount, lessonsCompleted, notesCount }
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
  const [stats, catalog, announcements] = await Promise.all([
    getStats(userId),
    memberCourseService.listCatalog(userId),
    getRecentAnnouncements(userId, ANNOUNCEMENT_LIMIT),
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
  }
}

export const dashboardService = {
  getMemberDashboard,
}

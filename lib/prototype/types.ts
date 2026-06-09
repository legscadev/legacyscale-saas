/**
 * Prototype view-model types. These mirror the Prisma schema closely so the
 * mock data doubles as realistic fixtures for the eventual real build.
 * Kept intentionally UI-focused (no DB-only fields like authId/deletedAt).
 */

export type Role = "ADMIN" | "MEMBER"
export type CourseStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED"
export type LessonType = "VIDEO" | "QUIZ" | "RESOURCE"
export type LessonStatus = "DRAFT" | "PROCESSING" | "READY"
export type QuestionType = "MULTIPLE_CHOICE" | "TRUE_FALSE"
export type AnnouncementStatus = "DRAFT" | "PUBLISHED"
export type EnrollmentStatus = "PENDING" | "ACTIVE" | "EXPIRED" | "REVOKED"
export type EnrollmentSource =
  | "MANUAL"
  | "GHL_WEBHOOK"
  | "ADMIN"
  | "SELF_ENROLL"

export interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string
  role: Role
  isActive: boolean
  emailVerified: boolean
  lastLoginAt?: string
  createdAt: string
}

export interface QuizQuestion {
  id: string
  questionText: string
  type: QuestionType
  options: string[]
  correctIndex: number
  explanation?: string
}

export interface Lesson {
  id: string
  chapterId: string
  title: string
  type: LessonType
  status: LessonStatus
  orderIndex: number
  description?: string
  /** VIDEO */
  durationSeconds?: number
  /** RESOURCE */
  resourceName?: string
  resourceSize?: number
  /** QUIZ */
  passingScore?: number
  maxAttempts?: number
  timeLimitMin?: number
  questions?: QuizQuestion[]
  /** Per-current-member progress (mock convenience) */
  completed?: boolean
  watchedPercent?: number
  lastPositionSec?: number
}

export interface Chapter {
  id: string
  courseId: string
  title: string
  orderIndex: number
  lessons: Lesson[]
}

export interface Course {
  id: string
  title: string
  description: string
  thumbnailUrl?: string
  status: CourseStatus
  orderIndex: number
  accessDays: number | null
  publishedAt?: string
  chapters: Chapter[]
  /** Aggregates (mock convenience) */
  lessonCount: number
  durationMinutes: number
  enrollmentCount: number
  completionRate: number
}

export interface Enrollment {
  id: string
  user: Pick<User, "id" | "name" | "email" | "avatarUrl">
  course: Pick<Course, "id" | "title">
  status: EnrollmentStatus
  source: EnrollmentSource
  progressPercent: number
  enrolledAt: string
  lastAccessedAt?: string
  expiresAt?: string | null
  revokedReason?: string
}

export interface Announcement {
  id: string
  title: string
  body: string
  status: AnnouncementStatus
  publishedAt?: string
  readRate: number
  read?: boolean
}

export interface QuizAttempt {
  id: string
  lessonTitle: string
  courseTitle: string
  score: number
  total: number
  passed: boolean
  createdAt: string
}

export interface ActivityItem {
  id: string
  type:
    | "enrollment"
    | "completion"
    | "quiz_passed"
    | "quiz_failed"
    | "announcement"
    | "member_joined"
    | "lesson_started"
  actor: string
  target: string
  timestamp: string
}

export interface TrendPoint {
  label: string
  value: number
}

export interface KpiStat {
  label: string
  value: string
  delta: number
  deltaLabel: string
  series: number[]
}

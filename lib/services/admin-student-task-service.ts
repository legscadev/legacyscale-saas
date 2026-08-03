// Admin-facing view of student personal tasks + goals. Sibling of
// studentTaskService (which is strictly user-scoped for the student's
// own /tasks page) — this service is the tenant-wide read path used
// by /admin/student-tasks, the per-student progress tab, and the
// admin dashboard widget.
//
// Read-only for now. Admins don't edit student tasks; the follow-up
// path is the Nudge system.

import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

export interface AdminStudentTaskItem {
  id: string
  title: string
  description: string | null
  dueDate: Date | null
  completedAt: Date | null
  createdAt: Date
  student: {
    id: string
    name: string | null
    email: string
    avatarUrl: string | null
  }
  linkedCourse: {
    id: string
    title: string
    slug: string
  } | null
  linkedLesson: {
    id: string
    title: string
    chapterId: string
  } | null
  /** dueDate < now && !completedAt — derived, not persisted. */
  isOverdue: boolean
}

export interface AdminStudentTaskFilters {
  /** Restrict to one student. Empty = every student on the tenant. */
  studentId?: string | null
  /** Restrict to tasks linked to a specific course. */
  courseId?: string | null
  /** Only surface tasks with a past due date + not yet completed. */
  overdueOnly?: boolean
  /** By default completed tasks are hidden — flip to show them. */
  includeCompleted?: boolean
  page?: number
  limit?: number
}

export interface AdminStudentTaskListResult {
  items: AdminStudentTaskItem[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasMore: boolean
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

const SELECT = {
  id: true,
  title: true,
  description: true,
  dueDate: true,
  completedAt: true,
  createdAt: true,
  user: {
    select: { id: true, name: true, email: true, avatarUrl: true },
  },
  linkedCourse: {
    select: { id: true, title: true, slug: true },
  },
  linkedLesson: {
    select: { id: true, title: true, chapterId: true },
  },
} as const satisfies Prisma.StudentTaskSelect

type Row = Prisma.StudentTaskGetPayload<{ select: typeof SELECT }>

function toItem(row: Row, now: number): AdminStudentTaskItem {
  const dueTime = row.dueDate ? row.dueDate.getTime() : null
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueDate: row.dueDate,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    student: row.user,
    linkedCourse: row.linkedCourse,
    linkedLesson: row.linkedLesson,
    isOverdue:
      dueTime !== null && dueTime < now && row.completedAt === null,
  }
}

class AdminStudentTaskService {
  /** Tenant-wide student task list. Tenancy is enforced upstream by
   *  the Prisma extension (StudentTask is a scoped model). */
  async list(
    filters: AdminStudentTaskFilters,
  ): Promise<AdminStudentTaskListResult> {
    const page = Math.max(1, filters.page ?? 1)
    const limit = Math.min(MAX_LIMIT, Math.max(1, filters.limit ?? DEFAULT_LIMIT))
    const skip = (page - 1) * limit
    const now = new Date()

    const where: Prisma.StudentTaskWhereInput = {}
    if (filters.studentId) where.userId = filters.studentId
    if (filters.courseId) where.linkedCourseId = filters.courseId
    if (!filters.includeCompleted) where.completedAt = null
    if (filters.overdueOnly) {
      where.completedAt = null
      where.dueDate = { lt: now }
    }

    // Sort: overdue first (due < now), then upcoming by due date,
    // then no-due-date tasks, then newest. Prisma has no computed
    // "overdue first" order, so we sort by dueDate ascending with
    // nulls last — puts everything with a due date at the top in
    // chronological order (past → future).
    const [items, total] = await Promise.all([
      prisma.studentTask.findMany({
        where,
        orderBy: [
          { dueDate: { sort: 'asc', nulls: 'last' } },
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
        select: SELECT,
      }),
      prisma.studentTask.count({ where }),
    ])

    return {
      items: items.map((r) => toItem(r, now.getTime())),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasMore: skip + items.length < total,
    }
  }

  /** Slim helper for the per-student card on
   *  /admin/progress/members/[id]. Returns the student's open tasks
   *  (overdue first via dueDate asc), capped at `limit`. */
  async listForStudent(
    studentId: string,
    limit = 6,
  ): Promise<AdminStudentTaskItem[]> {
    const now = new Date()
    const rows = await prisma.studentTask.findMany({
      where: { userId: studentId, completedAt: null },
      orderBy: [
        { dueDate: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      take: limit,
      select: SELECT,
    })
    return rows.map((r) => toItem(r, now.getTime()))
  }

  /** Total open + count-of-overdue for the per-student card. Cheap
   *  because it's two aggregate counts, no row fetches. */
  async countsForStudent(
    studentId: string,
  ): Promise<{ open: number; overdue: number }> {
    const now = new Date()
    const [open, overdue] = await Promise.all([
      prisma.studentTask.count({
        where: { userId: studentId, completedAt: null },
      }),
      prisma.studentTask.count({
        where: {
          userId: studentId,
          completedAt: null,
          dueDate: { lt: now },
        },
      }),
    ])
    return { open, overdue }
  }

  /** Count of tasks with a due date in the past that aren't done. Used
   *  by the "Needs attention" widget on /admin/dashboard. */
  async countOverdue(): Promise<number> {
    return prisma.studentTask.count({
      where: {
        completedAt: null,
        dueDate: { lt: new Date() },
      },
    })
  }

  /** Distinct students who own at least one task. Feeds the filter
   *  picker on /admin/student-tasks — no point offering students who
   *  never opened /tasks. */
  async listStudentsWithTasks(): Promise<
    Array<{ id: string; name: string | null; email: string }>
  > {
    const rows = await prisma.studentTask.findMany({
      distinct: ['userId'],
      select: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { user: { name: 'asc' } },
    })
    return rows.map((r) => r.user)
  }
}

export const adminStudentTaskService = new AdminStudentTaskService()

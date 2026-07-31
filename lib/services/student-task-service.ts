// Read/write helpers for the student's personal task list. Every
// method is user-scoped — no cross-user reads, no admin overrides.
// The service enforces ownership so a stray id from another user
// can't be flipped by guessing it.

import { prisma } from '@/lib/prisma'
import { getRequestCompanyId } from '@/lib/tenancy/request-company'

export class StudentTaskNotFoundError extends Error {
  constructor(message = 'Task not found') {
    super(message)
    this.name = 'StudentTaskNotFoundError'
  }
}

export interface StudentTaskItem {
  id: string
  title: string
  description: string | null
  dueDate: Date | null
  completedAt: Date | null
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
  createdAt: Date
  updatedAt: Date
}

const SELECT = {
  id: true,
  title: true,
  description: true,
  dueDate: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  linkedCourse: {
    select: { id: true, title: true, slug: true },
  },
  linkedLesson: {
    select: { id: true, title: true, chapterId: true },
  },
} as const

async function requireCompanyId(): Promise<string> {
  const id = await getRequestCompanyId()
  if (!id) throw new Error('student-task-service: no active company')
  return id
}

class StudentTaskService {
  /** All of the user's tasks, open ones first (by due date), then
   *  completed. Cap at 200 — anyone with more is doing something
   *  strange and can page later. */
  async list(userId: string): Promise<StudentTaskItem[]> {
    return prisma.studentTask.findMany({
      where: { userId },
      orderBy: [
        { completedAt: { sort: 'asc', nulls: 'first' } },
        { dueDate: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      take: 200,
      select: SELECT,
    })
  }

  /** Just the upcoming/overdue slice for the dashboard widget. */
  async listUpcoming(
    userId: string,
    limit = 5,
  ): Promise<StudentTaskItem[]> {
    return prisma.studentTask.findMany({
      where: { userId, completedAt: null },
      orderBy: [
        { dueDate: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      take: limit,
      select: SELECT,
    })
  }

  async create(input: {
    userId: string
    title: string
    description?: string | null
    dueDate?: Date | null
    linkedCourseId?: string | null
    linkedLessonId?: string | null
  }): Promise<StudentTaskItem> {
    const companyId = await requireCompanyId()
    return prisma.studentTask.create({
      data: {
        userId: input.userId,
        companyId,
        title: input.title,
        description: input.description ?? null,
        dueDate: input.dueDate ?? null,
        linkedCourseId: input.linkedCourseId ?? null,
        linkedLessonId: input.linkedLessonId ?? null,
      },
      select: SELECT,
    })
  }

  async update(input: {
    userId: string
    taskId: string
    title?: string
    description?: string | null
    dueDate?: Date | null
    linkedCourseId?: string | null
    linkedLessonId?: string | null
  }): Promise<StudentTaskItem> {
    await this.assertOwned(input.userId, input.taskId)
    return prisma.studentTask.update({
      where: { id: input.taskId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
        ...(input.linkedCourseId !== undefined
          ? { linkedCourseId: input.linkedCourseId }
          : {}),
        ...(input.linkedLessonId !== undefined
          ? { linkedLessonId: input.linkedLessonId }
          : {}),
      },
      select: SELECT,
    })
  }

  async toggle(input: {
    userId: string
    taskId: string
    completed: boolean
  }): Promise<StudentTaskItem> {
    await this.assertOwned(input.userId, input.taskId)
    return prisma.studentTask.update({
      where: { id: input.taskId },
      data: { completedAt: input.completed ? new Date() : null },
      select: SELECT,
    })
  }

  async delete(input: { userId: string; taskId: string }): Promise<void> {
    await this.assertOwned(input.userId, input.taskId)
    await prisma.studentTask.delete({ where: { id: input.taskId } })
  }

  private async assertOwned(userId: string, taskId: string): Promise<void> {
    const row = await prisma.studentTask.findFirst({
      where: { id: taskId, userId },
      select: { id: true },
    })
    if (!row) throw new StudentTaskNotFoundError()
  }
}

export const studentTaskService = new StudentTaskService()

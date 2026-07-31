// CRUD + student-facing helpers for LessonTaskSuggestion. Admin
// side uses the CRUD methods; the student "Add to my tasks" flow
// calls addToStudentTasks which snapshots title/description into
// a StudentTask so later admin edits don't reshape the student's
// personal list.

import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { getRequestCompanyId } from '@/lib/tenancy/request-company'

export class LessonTaskSuggestionNotFoundError extends Error {
  constructor(message = 'Suggested task not found') {
    super(message)
    this.name = 'LessonTaskSuggestionNotFoundError'
  }
}

export interface LessonTaskSuggestionRow {
  id: string
  lessonId: string
  title: string
  description: string | null
  orderIndex: number
  createdAt: Date
  updatedAt: Date
}

const SELECT = {
  id: true,
  lessonId: true,
  title: true,
  description: true,
  orderIndex: true,
  createdAt: true,
  updatedAt: true,
} as const

async function requireCompanyId(): Promise<string> {
  const id = await getRequestCompanyId()
  if (!id) throw new Error('lesson-task-suggestion-service: no active company')
  return id
}

class LessonTaskSuggestionService {
  /** Ordered list of suggestions for a lesson. Ordering is stable
   *  across create/edit/reorder — the admin drag-order is what the
   *  student sees. */
  async listForLesson(lessonId: string): Promise<LessonTaskSuggestionRow[]> {
    return prisma.lessonTaskSuggestion.findMany({
      where: { lessonId },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      select: SELECT,
    })
  }

  async create(input: {
    lessonId: string
    title: string
    description?: string | null
  }): Promise<LessonTaskSuggestionRow> {
    const companyId = await requireCompanyId()
    // Append to the tail so newest sits at the bottom until the
    // admin explicitly reorders. Matches the CRM opportunity + note
    // ordering elsewhere in the codebase.
    const last = await prisma.lessonTaskSuggestion.findFirst({
      where: { lessonId: input.lessonId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    })
    return prisma.lessonTaskSuggestion.create({
      data: {
        lessonId: input.lessonId,
        title: input.title,
        description: input.description ?? null,
        orderIndex: (last?.orderIndex ?? -1) + 1,
        companyId,
      },
      select: SELECT,
    })
  }

  async update(input: {
    suggestionId: string
    title?: string
    description?: string | null
  }): Promise<LessonTaskSuggestionRow> {
    await this.assertExists(input.suggestionId)
    return prisma.lessonTaskSuggestion.update({
      where: { id: input.suggestionId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
      },
      select: SELECT,
    })
  }

  async delete(suggestionId: string): Promise<void> {
    await prisma.lessonTaskSuggestion.delete({ where: { id: suggestionId } })
  }

  /** Rewrite orderIndex for every suggestion of a lesson in one
   *  UPDATE ... CASE statement — same pattern as stat-tracker's
   *  reorderMetrics so 30+ suggestions don't blow the pool
   *  timeout. */
  async reorder(input: {
    lessonId: string
    suggestionIds: string[]
  }): Promise<void> {
    if (input.suggestionIds.length === 0) return
    const cases = Prisma.join(
      input.suggestionIds.map(
        (id, index) =>
          Prisma.sql`WHEN ${id} THEN ${Prisma.raw(String(index))}`,
      ),
      ' ',
    )
    const idList = Prisma.join(input.suggestionIds)
    await prisma.$executeRaw`
      UPDATE lesson_task_suggestions
      SET order_index = CASE id ${cases} END
      WHERE lesson_id = ${input.lessonId}
        AND id IN (${idList})
    `
  }

  /**
   * Student-side one-click. Copies the suggestion's title +
   * description into a new StudentTask, links it back to the
   * lesson + course. Snapshot semantics — future admin edits
   * don't change the student's copy.
   */
  async addToStudentTasks(input: {
    suggestionId: string
    userId: string
    dueDate?: Date | null
  }): Promise<{ taskId: string }> {
    const companyId = await requireCompanyId()
    const suggestion = await prisma.lessonTaskSuggestion.findFirst({
      where: { id: input.suggestionId },
      select: {
        id: true,
        title: true,
        description: true,
        lessonId: true,
        lesson: {
          select: { chapter: { select: { courseId: true } } },
        },
      },
    })
    if (!suggestion) throw new LessonTaskSuggestionNotFoundError()

    const task = await prisma.studentTask.create({
      data: {
        userId: input.userId,
        companyId,
        title: suggestion.title,
        description: suggestion.description ?? null,
        dueDate: input.dueDate ?? null,
        linkedLessonId: suggestion.lessonId,
        linkedCourseId: suggestion.lesson.chapter.courseId,
      },
      select: { id: true },
    })
    return { taskId: task.id }
  }

  private async assertExists(id: string): Promise<void> {
    const row = await prisma.lessonTaskSuggestion.findFirst({
      where: { id },
      select: { id: true },
    })
    if (!row) throw new LessonTaskSuggestionNotFoundError()
  }
}

export const lessonTaskSuggestionService = new LessonTaskSuggestionService()

'use server'

// Server actions for the student's personal task/goal surface.
// Every action re-derives the actor from the session (never trusts
// a userId from the client) and delegates to studentTaskService,
// which enforces ownership at the DB layer.

import { revalidatePath } from 'next/cache'

import { requireActiveUser } from '@/lib/auth/get-user'
import {
  lessonTaskSuggestionService,
  LessonTaskSuggestionNotFoundError,
} from '@/lib/services/lesson-task-suggestion-service'
import {
  studentTaskService,
  StudentTaskNotFoundError,
  type StudentTaskItem,
} from '@/lib/services/student-task-service'
import { addSuggestionToTasksSchema } from '@/lib/validations/lesson-task-suggestion'
import {
  createStudentTaskSchema,
  deleteStudentTaskSchema,
  toggleStudentTaskSchema,
  updateStudentTaskSchema,
  type CreateStudentTaskInput,
  type UpdateStudentTaskInput,
} from '@/lib/validations/student-task'

// ============================================
// SHARED RESULT SHAPES
// ============================================

export interface MutationOk<T = void> {
  ok: true
  data: T
}
export interface MutationErr {
  ok: false
  error?: string
  fieldErrors?: Record<string, string[]>
}
export type MutationResult<T = void> = MutationOk<T> | MutationErr

function fieldErrorsFromZod(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || '_root'
    if (!out[key]) out[key] = []
    out[key]!.push(issue.message)
  }
  return out
}

function toErr(err: unknown, fallback: string): MutationErr {
  if (err instanceof StudentTaskNotFoundError) {
    return { ok: false, error: err.message }
  }
  if (err instanceof LessonTaskSuggestionNotFoundError) {
    return { ok: false, error: err.message }
  }
  console.error('[tasks/actions]', fallback, err)
  return {
    ok: false,
    error: err instanceof Error ? err.message : fallback,
  }
}

function revalidateAll(): void {
  revalidatePath('/tasks')
  revalidatePath('/dashboard')
}

// ============================================
// READ
// ============================================

export async function fetchStudentTasksAction(): Promise<
  MutationResult<StudentTaskItem[]>
> {
  const user = await requireActiveUser()
  try {
    const data = await studentTaskService.list(user.id)
    return { ok: true, data }
  } catch (err) {
    return toErr(err, 'Could not load tasks')
  }
}

// ============================================
// MUTATIONS
// ============================================

export async function createStudentTaskAction(
  input: CreateStudentTaskInput,
): Promise<MutationResult<StudentTaskItem>> {
  const user = await requireActiveUser()
  const parsed = createStudentTaskSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }
  try {
    const data = await studentTaskService.create({
      userId: user.id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      dueDate: parsed.data.dueDate ?? null,
      linkedCourseId: parsed.data.linkedCourseId ?? null,
      linkedLessonId: parsed.data.linkedLessonId ?? null,
    })
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toErr(err, 'Could not create task')
  }
}

export async function updateStudentTaskAction(
  input: UpdateStudentTaskInput,
): Promise<MutationResult<StudentTaskItem>> {
  const user = await requireActiveUser()
  const parsed = updateStudentTaskSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }
  try {
    const data = await studentTaskService.update({
      userId: user.id,
      taskId: parsed.data.taskId,
      title: parsed.data.title,
      description: parsed.data.description,
      dueDate: parsed.data.dueDate,
      linkedCourseId: parsed.data.linkedCourseId,
      linkedLessonId: parsed.data.linkedLessonId,
    })
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toErr(err, 'Could not update task')
  }
}

export async function toggleStudentTaskAction(
  input: Record<string, unknown>,
): Promise<MutationResult<StudentTaskItem>> {
  const user = await requireActiveUser()
  const parsed = toggleStudentTaskSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }
  try {
    const data = await studentTaskService.toggle({
      userId: user.id,
      taskId: parsed.data.taskId,
      completed: parsed.data.completed,
    })
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toErr(err, 'Could not update task')
  }
}

export async function deleteStudentTaskAction(
  input: Record<string, unknown>,
): Promise<MutationResult> {
  const user = await requireActiveUser()
  const parsed = deleteStudentTaskSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }
  try {
    await studentTaskService.delete({
      userId: user.id,
      taskId: parsed.data.taskId,
    })
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toErr(err, 'Could not delete task')
  }
}

/**
 * One-click "Add to my tasks" from a lesson's suggested-tasks list.
 * Snapshots the suggestion's title/description into a StudentTask
 * and links it back to the lesson + course. Optional dueDate lets
 * the student set a deadline in the same click.
 */
export async function addSuggestionToTasksAction(
  input: Record<string, unknown>,
): Promise<MutationResult<{ taskId: string }>> {
  const user = await requireActiveUser()
  const parsed = addSuggestionToTasksSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }
  try {
    const data = await lessonTaskSuggestionService.addToStudentTasks({
      suggestionId: parsed.data.suggestionId,
      userId: user.id,
      dueDate: parsed.data.dueDate,
    })
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toErr(err, 'Could not add suggested task')
  }
}

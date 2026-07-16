'use server'

// Server actions for the Internal Task Tracker. Every action is a
// thin controller: auth check → parse with Zod → hand off to a
// service → revalidate the affected paths → return {ok, ...} or
// {ok:false, error, fieldErrors}.
//
// The tracker's UI won't land until Phase 2+; these actions are
// wired now so the smoke test and the UI can call them without
// duplicating the parse/dispatch layer.

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/auth/get-user'
import {
  taskAssignmentService,
} from '@/lib/services/task-assignment-service'
import {
  taskChecklistService,
  ChecklistItemNotFoundError,
  ChecklistNotFoundError,
} from '@/lib/services/task-checklist-service'
import {
  taskCommentService,
  CommentForbiddenError,
  CommentNotFoundError,
} from '@/lib/services/task-comment-service'
import {
  taskService,
  TaskNotFoundError,
  type TaskDetail,
  type TaskListResult,
} from '@/lib/services/task-service'
import { ensureWorkflowReady } from '@/lib/services/task-workflow-service'
import { getRequestCompanyId } from '@/lib/tenancy/request-company'
import {
  addChecklistItemSchema,
  addCommentSchema,
  assignTaskSchema,
  changeStatusSchema,
  createChecklistSchema,
  createTaskSchema,
  editCommentSchema,
  renameChecklistSchema,
  reorderChecklistItemsSchema,
  taskFilterSchema,
  updateChecklistItemSchema,
  updateTaskSchema,
  watchTaskSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
} from '@/lib/validations/tasks'

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

/**
 * Translate a thrown service error into a client-safe {ok:false, ...}.
 * NotFound → 404-style message; forbidden → 403-style. Everything
 * else swallows the stack + emits a generic string so we don't leak
 * internals to the UI.
 */
function toMutationErr(err: unknown, fallback: string): MutationErr {
  if (
    err instanceof TaskNotFoundError ||
    err instanceof CommentNotFoundError ||
    err instanceof ChecklistNotFoundError ||
    err instanceof ChecklistItemNotFoundError
  ) {
    return { ok: false, error: err.message }
  }
  if (err instanceof CommentForbiddenError) {
    return { ok: false, error: err.message }
  }
  console.error('[tasks/actions]', fallback, err)
  const message = err instanceof Error ? err.message : fallback
  return { ok: false, error: message }
}

function revalidateAll(): void {
  revalidatePath('/admin/tasks')
}

// ============================================
// READ
// ============================================

export interface TaskListPayload extends TaskListResult {}

/**
 * List tasks for the current tenant. Runs the workflow-ready check
 * inline so first-time visits seed the default statuses / labels /
 * categories before the list renders. Filter validation lets the
 * UI encode search+filters straight into the URL query string.
 */
export async function fetchTasksAction(
  filters: Record<string, unknown> = {},
): Promise<MutationResult<TaskListPayload>> {
  await requireAdmin()
  const companyId = await getRequestCompanyId()
  if (companyId) await ensureWorkflowReady(companyId)

  const parsed = taskFilterSchema.safeParse(filters)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  try {
    const data = await taskService.list(parsed.data)
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not load tasks')
  }
}

export async function fetchTaskAction(
  id: string,
): Promise<MutationResult<TaskDetail>> {
  await requireAdmin()
  try {
    const data = await taskService.get(id)
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not load task')
  }
}

// ============================================
// TASK MUTATIONS
// ============================================

export async function createTaskAction(
  input: CreateTaskInput,
): Promise<MutationResult<TaskDetail>> {
  const user = await requireAdmin()
  const parsed = createTaskSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  try {
    const companyId = await getRequestCompanyId()
    if (companyId) await ensureWorkflowReady(companyId)
    const data = await taskService.create(parsed.data, user.id)
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not create task')
  }
}

export async function updateTaskAction(
  id: string,
  input: UpdateTaskInput,
): Promise<MutationResult<TaskDetail>> {
  const user = await requireAdmin()
  const parsed = updateTaskSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  try {
    const data = await taskService.update(id, parsed.data, user.id)
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not update task')
  }
}

export async function changeTaskStatusAction(
  input: Record<string, unknown>,
): Promise<MutationResult<TaskDetail>> {
  const user = await requireAdmin()
  const parsed = changeStatusSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  try {
    const data = await taskService.changeStatus(
      parsed.data.taskId,
      parsed.data.statusId,
      user.id,
      parsed.data.orderIndex,
    )
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not change status')
  }
}

export async function archiveTaskAction(
  id: string,
): Promise<MutationResult<TaskDetail>> {
  const user = await requireAdmin()
  try {
    const data = await taskService.archive(id, user.id)
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not archive task')
  }
}

export async function restoreTaskAction(
  id: string,
): Promise<MutationResult<TaskDetail>> {
  const user = await requireAdmin()
  try {
    const data = await taskService.restore(id, user.id)
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not restore task')
  }
}

export async function deleteTaskAction(
  id: string,
): Promise<MutationResult> {
  const user = await requireAdmin()
  try {
    await taskService.softDelete(id, user.id)
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toMutationErr(err, 'Could not delete task')
  }
}

export async function duplicateTaskAction(
  id: string,
): Promise<MutationResult<TaskDetail>> {
  const user = await requireAdmin()
  try {
    const data = await taskService.duplicate(id, user.id)
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not duplicate task')
  }
}

// ============================================
// COMMENTS
// ============================================

export async function addCommentAction(
  input: Record<string, unknown>,
): Promise<MutationResult<{ id: string }>> {
  const user = await requireAdmin()
  const parsed = addCommentSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  try {
    const row = await taskCommentService.add(parsed.data, user.id)
    revalidateAll()
    return { ok: true, data: { id: row.id } }
  } catch (err) {
    return toMutationErr(err, 'Could not add comment')
  }
}

export async function editCommentAction(
  input: Record<string, unknown>,
): Promise<MutationResult<{ id: string }>> {
  const user = await requireAdmin()
  const parsed = editCommentSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  try {
    const row = await taskCommentService.edit(parsed.data, user.id)
    revalidateAll()
    return { ok: true, data: { id: row.id } }
  } catch (err) {
    return toMutationErr(err, 'Could not edit comment')
  }
}

export async function deleteCommentAction(
  commentId: string,
): Promise<MutationResult> {
  const user = await requireAdmin()
  try {
    // Admin path — canDeleteAny=true. When a member-level tracker
    // surface ships later, gate this per-role.
    await taskCommentService.delete(commentId, user.id, true)
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toMutationErr(err, 'Could not delete comment')
  }
}

// ============================================
// CHECKLISTS
// ============================================

export async function createChecklistAction(
  input: Record<string, unknown>,
): Promise<MutationResult<{ id: string }>> {
  const user = await requireAdmin()
  const parsed = createChecklistSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  try {
    const row = await taskChecklistService.createChecklist(parsed.data, user.id)
    revalidateAll()
    return { ok: true, data: { id: row.id } }
  } catch (err) {
    return toMutationErr(err, 'Could not create checklist')
  }
}

export async function renameChecklistAction(
  input: Record<string, unknown>,
): Promise<MutationResult> {
  await requireAdmin()
  const parsed = renameChecklistSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  try {
    await taskChecklistService.renameChecklist(parsed.data)
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toMutationErr(err, 'Could not rename checklist')
  }
}

export async function deleteChecklistAction(
  checklistId: string,
): Promise<MutationResult> {
  const user = await requireAdmin()
  try {
    await taskChecklistService.deleteChecklist(checklistId, user.id)
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toMutationErr(err, 'Could not delete checklist')
  }
}

export async function addChecklistItemAction(
  input: Record<string, unknown>,
): Promise<MutationResult<{ id: string }>> {
  const user = await requireAdmin()
  const parsed = addChecklistItemSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  try {
    const row = await taskChecklistService.addItem(parsed.data, user.id)
    revalidateAll()
    return { ok: true, data: { id: row.id } }
  } catch (err) {
    return toMutationErr(err, 'Could not add checklist item')
  }
}

export async function updateChecklistItemAction(
  input: Record<string, unknown>,
): Promise<MutationResult> {
  const user = await requireAdmin()
  const parsed = updateChecklistItemSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  try {
    await taskChecklistService.updateItem(parsed.data, user.id)
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toMutationErr(err, 'Could not update checklist item')
  }
}

export async function deleteChecklistItemAction(
  itemId: string,
): Promise<MutationResult> {
  const user = await requireAdmin()
  try {
    await taskChecklistService.deleteItem(itemId, user.id)
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toMutationErr(err, 'Could not delete checklist item')
  }
}

export async function reorderChecklistItemsAction(
  input: Record<string, unknown>,
): Promise<MutationResult> {
  await requireAdmin()
  const parsed = reorderChecklistItemsSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  try {
    await taskChecklistService.reorderItems(parsed.data)
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toMutationErr(err, 'Could not reorder checklist items')
  }
}

// ============================================
// ASSIGNMENT / WATCHERS
// ============================================

export async function setAssigneesAction(
  input: Record<string, unknown>,
): Promise<MutationResult> {
  const user = await requireAdmin()
  const parsed = assignTaskSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  try {
    await taskAssignmentService.setAssignees(parsed.data, user.id)
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toMutationErr(err, 'Could not set assignees')
  }
}

export async function setWatchersAction(
  input: Record<string, unknown>,
): Promise<MutationResult> {
  const user = await requireAdmin()
  const parsed = watchTaskSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  try {
    await taskAssignmentService.setWatchers(parsed.data, user.id)
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toMutationErr(err, 'Could not set watchers')
  }
}

export async function watchTaskAction(
  taskId: string,
): Promise<MutationResult> {
  const user = await requireAdmin()
  try {
    await taskAssignmentService.watch(taskId, user.id, user.id)
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toMutationErr(err, 'Could not watch task')
  }
}

export async function unwatchTaskAction(
  taskId: string,
): Promise<MutationResult> {
  const user = await requireAdmin()
  try {
    await taskAssignmentService.unwatch(taskId, user.id, user.id)
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toMutationErr(err, 'Could not unwatch task')
  }
}

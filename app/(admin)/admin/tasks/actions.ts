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
import { prisma } from '@/lib/prisma'
import {
  taskAssignmentService,
} from '@/lib/services/task-assignment-service'
import { taskActivityService } from '@/lib/services/task-activity-service'
import type { TaskActivityRow } from '@/lib/services/task-activity-service'
import {
  taskChecklistService,
  ChecklistItemNotFoundError,
  ChecklistNotFoundError,
  type ChecklistRow,
} from '@/lib/services/task-checklist-service'
import {
  taskCommentService,
  CommentForbiddenError,
  CommentNotFoundError,
  type TaskCommentRow,
} from '@/lib/services/task-comment-service'
import {
  taskService,
  TaskNotFoundError,
  type TaskDetail,
  type TaskListResult,
} from '@/lib/services/task-service'
import { ensureWorkflowReady } from '@/lib/services/task-workflow-service'
import {
  getRequestCompanyId,
  memberTenantScope,
} from '@/lib/tenancy/request-company'
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

/**
 * Bundled payload for the detail drawer — task + comments +
 * checklists + activity in one round trip so opening a card
 * doesn't waterfall four independent fetches.
 */
export interface TaskDrawerPayload {
  task: TaskDetail
  comments: TaskCommentRow[]
  checklists: ChecklistRow[]
  activity: TaskActivityRow[]
}

export async function fetchTaskDrawerAction(
  id: string,
): Promise<MutationResult<TaskDrawerPayload>> {
  await requireAdmin()
  try {
    const [task, comments, checklists, activity] = await Promise.all([
      taskService.get(id),
      taskCommentService.list(id),
      taskChecklistService.listForTask(id),
      taskActivityService.listForTask(id, { limit: 100 }),
    ])
    return {
      ok: true,
      data: { task, comments, checklists, activity: activity.items },
    }
  } catch (err) {
    return toMutationErr(err, 'Could not load task')
  }
}

// ============================================
// WORKSPACE FETCHER
// ============================================

/**
 * Everything the tracker's list/kanban shell needs on first render:
 * tenant workflow rows + team members (for assignee/reporter pickers)
 * + the initial filtered task list + stats.
 *
 * One server-side round trip so the client shell hydrates without a
 * flash of empty pickers. Filters + pagination for the task list are
 * passed through to fetchTasksAction internally so the URL-driven
 * refetch path shares code with the initial render.
 */
export interface WorkflowStatus {
  id: string
  name: string
  slug: string
  color: string
  orderIndex: number
  isDefault: boolean
  isTerminal: boolean
  wipLimit: number | null
}

export interface WorkflowCategory {
  id: string
  name: string
  color: string
}

export interface WorkflowLabel {
  id: string
  name: string
  color: string
}

export interface TeamMember {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
}

export interface TaskStats {
  total: number
  openTotal: number
  byStatus: Array<{ statusId: string; name: string; count: number }>
  overdue: number
  dueSoon: number
  archived: number
}

export interface TaskWorkspacePayload {
  statuses: WorkflowStatus[]
  categories: WorkflowCategory[]
  labels: WorkflowLabel[]
  members: TeamMember[]
  tasks: TaskListResult
  stats: TaskStats
}

/** Sum counts for the "open"/"in-progress"/"blocked"/"done"/etc.
 *  strip. Reads from the DB directly rather than re-listing tasks
 *  so we don't pay for join hydration on numbers. */
async function loadStats(companyId: string): Promise<TaskStats> {
  const now = new Date()
  const in3days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

  const [byStatusRows, statuses, overdue, dueSoon, archived] = await Promise.all([
    prisma.task.groupBy({
      by: ['statusId'],
      where: { companyId, deletedAt: null, archivedAt: null },
      _count: { _all: true },
    }),
    prisma.taskStatus.findMany({
      where: { companyId },
      select: { id: true, name: true, isTerminal: true, orderIndex: true },
      orderBy: { orderIndex: 'asc' },
    }),
    prisma.task.count({
      where: {
        companyId,
        deletedAt: null,
        archivedAt: null,
        dueDate: { lt: now },
        status: { isTerminal: false },
      },
    }),
    prisma.task.count({
      where: {
        companyId,
        deletedAt: null,
        archivedAt: null,
        dueDate: { gte: now, lte: in3days },
        status: { isTerminal: false },
      },
    }),
    prisma.task.count({
      where: { companyId, deletedAt: null, archivedAt: { not: null } },
    }),
  ])

  const countByStatus = new Map(
    byStatusRows.map((r) => [r.statusId, r._count._all]),
  )
  const byStatus = statuses.map((s) => ({
    statusId: s.id,
    name: s.name,
    count: countByStatus.get(s.id) ?? 0,
  }))
  const openTotal = statuses
    .filter((s) => !s.isTerminal)
    .reduce((sum, s) => sum + (countByStatus.get(s.id) ?? 0), 0)
  const total = byStatusRows.reduce((sum, r) => sum + r._count._all, 0)

  return { total, openTotal, byStatus, overdue, dueSoon, archived }
}

/** Sole entry point for `/admin/tasks` first render. */
export async function fetchTaskWorkspaceAction(
  filters: Record<string, unknown> = {},
): Promise<MutationResult<TaskWorkspacePayload>> {
  await requireAdmin()
  const companyId = await getRequestCompanyId()
  if (companyId) await ensureWorkflowReady(companyId)

  const parsedFilters = taskFilterSchema.safeParse(filters)
  if (!parsedFilters.success) {
    return {
      ok: false,
      fieldErrors: fieldErrorsFromZod(parsedFilters.error.issues),
    }
  }

  try {
    const tenantScope = await memberTenantScope()
    const [statuses, categories, labels, members, tasks, stats] =
      await Promise.all([
        prisma.taskStatus.findMany({
          orderBy: { orderIndex: 'asc' },
          select: {
            id: true,
            name: true,
            slug: true,
            color: true,
            orderIndex: true,
            isDefault: true,
            isTerminal: true,
            wipLimit: true,
          },
        }),
        prisma.taskCategory.findMany({
          orderBy: { name: 'asc' },
          select: { id: true, name: true, color: true },
        }),
        prisma.taskLabel.findMany({
          orderBy: { name: 'asc' },
          select: { id: true, name: true, color: true },
        }),
        prisma.user.findMany({
          where: {
            deletedAt: null,
            isActive: true,
            role: { in: ['ADMIN', 'TEAM'] },
            ...tenantScope,
          },
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
          orderBy: [{ name: 'asc' }, { email: 'asc' }],
        }),
        taskService.list(parsedFilters.data),
        companyId ? loadStats(companyId) : Promise.resolve<TaskStats>({
          total: 0,
          openTotal: 0,
          byStatus: [],
          overdue: 0,
          dueSoon: 0,
          archived: 0,
        }),
      ])

    return {
      ok: true,
      data: { statuses, categories, labels, members, tasks, stats },
    }
  } catch (err) {
    return toMutationErr(err, 'Could not load task workspace')
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

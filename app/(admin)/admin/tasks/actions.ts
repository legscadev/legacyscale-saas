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
  taskAttachmentService,
  TaskAttachmentNotFoundError,
  type TaskAttachmentRow,
} from '@/lib/services/task-attachment-service'
import {
  taskSavedViewService,
  DuplicateSavedViewError,
  SavedViewNotFoundError,
  type SavedViewRow,
} from '@/lib/services/task-saved-view-service'
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
    err instanceof ChecklistItemNotFoundError ||
    err instanceof TaskAttachmentNotFoundError ||
    err instanceof SavedViewNotFoundError ||
    err instanceof DuplicateSavedViewError
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
  attachments: TaskAttachmentRow[]
}

export async function fetchTaskDrawerAction(
  id: string,
): Promise<MutationResult<TaskDrawerPayload>> {
  await requireAdmin()
  try {
    const [task, comments, checklists, activity, attachments] =
      await Promise.all([
        taskService.get(id),
        taskCommentService.list(id),
        taskChecklistService.listForTask(id),
        taskActivityService.listForTask(id, { limit: 100 }),
        taskAttachmentService.listForTask(id),
      ])
    return {
      ok: true,
      data: {
        task,
        comments,
        checklists,
        activity: activity.items,
        attachments,
      },
    }
  } catch (err) {
    return toMutationErr(err, 'Could not load task')
  }
}

// ============================================
// ATTACHMENTS
// ============================================

/**
 * Multipart upload. Server actions accept FormData with File —
 * the client packages the picker's selected files here.
 * Reads MAX_ATTACHMENT_BYTES from the service, so bumping the
 * limit is a one-file change.
 */
export async function uploadTaskAttachmentAction(
  formData: FormData,
): Promise<MutationResult<TaskAttachmentRow>> {
  const user = await requireAdmin()
  const taskId = String(formData.get('taskId') ?? '')
  const file = formData.get('file')
  if (!taskId) {
    return { ok: false, error: 'Missing taskId' }
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'No file provided' }
  }

  try {
    const data = await taskAttachmentService.upload({
      taskId,
      file,
      actorId: user.id,
    })
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not upload attachment')
  }
}

/**
 * Register a link attachment (Google Drive / Frame.io / Figma /
 * arbitrary URL) — no bytes uploaded, just a bookmark on the task.
 * The URL is validated as an http(s) URL before the row is written
 * so pasted rubbish doesn't sneak into the drawer.
 */
export async function registerTaskLinkAttachmentAction(input: {
  taskId: string
  name: string
  url: string
}): Promise<MutationResult<TaskAttachmentRow>> {
  const user = await requireAdmin()
  const url = input.url.trim()
  if (!url) return { ok: false, error: 'URL is required' }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { ok: false, error: 'Invalid URL' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'URL must start with http:// or https://' }
  }
  try {
    const data = await taskAttachmentService.registerLink({
      taskId: input.taskId,
      name: input.name,
      url,
      actorId: user.id,
    })
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not add link')
  }
}

export async function deleteTaskAttachmentAction(
  attachmentId: string,
): Promise<MutationResult> {
  const user = await requireAdmin()
  try {
    await taskAttachmentService.delete(attachmentId, user.id)
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toMutationErr(err, 'Could not delete attachment')
  }
}

/** Mint a short-lived signed URL for downloading an attachment. The
 *  client uses this to open the file directly (window.open) rather
 *  than proxying bytes through the server action response. */
export async function signTaskAttachmentUrlAction(
  attachmentId: string,
): Promise<MutationResult<{ url: string }>> {
  await requireAdmin()
  try {
    const url = await taskAttachmentService.signDownloadUrl(attachmentId)
    return { ok: true, data: { url } }
  } catch (err) {
    return toMutationErr(err, 'Could not sign download URL')
  }
}

// ============================================
// WORKSPACE FETCHER
// ============================================

/**
 * Everything the tracker's list/kanban shell needs on first render:
 * tenant workflow rows + team members (for assignee/reporter pickers)
 * + the initial filtered task list.
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

export interface TaskWorkspacePayload {
  statuses: WorkflowStatus[]
  categories: WorkflowCategory[]
  labels: WorkflowLabel[]
  members: TeamMember[]
  tasks: TaskListResult
  /** Current viewer's user id — the client uses this to decide
   *  which comments the current viewer authored (and can therefore
   *  edit inline). Admins can delete any comment via the row menu. */
  currentUserId: string
  /** Saved views authored by the current user in the current
   *  tenant. Populates the "Views" dropdown next to the filter bar. */
  savedViews: SavedViewRow[]
}

/** Sole entry point for `/admin/tasks` first render. */
export async function fetchTaskWorkspaceAction(
  filters: Record<string, unknown> = {},
): Promise<MutationResult<TaskWorkspacePayload>> {
  const currentUser = await requireAdmin()
  const companyId = await getRequestCompanyId()
  if (companyId) await ensureWorkflowReady(companyId)

  // "Only mine" is a URL-level convenience — the client sends it
  // instead of trying to encode the operator's own user id in the
  // query string. Fold it into assigneeIds here (merging with any
  // explicit picks so both stay in effect) then strip so the
  // schema doesn't reject an unknown key.
  const mine = filters.mine === true
  const cleanedFilters: Record<string, unknown> = { ...filters }
  delete cleanedFilters.mine
  if (mine) {
    const existing = Array.isArray(cleanedFilters.assigneeIds)
      ? (cleanedFilters.assigneeIds as string[])
      : []
    const set = new Set<string>([...existing, currentUser.id])
    cleanedFilters.assigneeIds = Array.from(set)
  }

  const parsedFilters = taskFilterSchema.safeParse(cleanedFilters)
  if (!parsedFilters.success) {
    return {
      ok: false,
      fieldErrors: fieldErrorsFromZod(parsedFilters.error.issues),
    }
  }

  try {
    const tenantScope = await memberTenantScope()
    const [statuses, categories, labels, members, tasks, savedViews] =
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
        taskSavedViewService.listMine(currentUser.id),
      ])

    return {
      ok: true,
      data: {
        statuses,
        categories,
        labels,
        members,
        tasks,
        currentUserId: currentUser.id,
        savedViews,
      },
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

// ============================================
// SAVED VIEWS
// ============================================

export async function createSavedViewAction(input: {
  name: string
  query: string
}): Promise<MutationResult<SavedViewRow>> {
  const user = await requireAdmin()
  const name = input.name.trim()
  if (!name) return { ok: false, error: 'Name is required' }
  if (name.length > 60) return { ok: false, error: 'Name is too long (max 60)' }
  try {
    const data = await taskSavedViewService.create({
      userId: user.id,
      name,
      query: input.query,
    })
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not save view')
  }
}

export async function deleteSavedViewAction(
  id: string,
): Promise<MutationResult> {
  const user = await requireAdmin()
  try {
    await taskSavedViewService.delete({ id, userId: user.id })
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toMutationErr(err, 'Could not delete view')
  }
}

// ============================================
// BULK ACTIONS
// ============================================

/**
 * Bulk mutations loop the per-row service methods rather than
 * batching at the DB layer — each row still fires its activity
 * log + notifications, and one bad row doesn't tank the batch
 * (per-row errors accumulate into failedIds).
 */
export interface BulkResult {
  ok: true
  data: { updated: number; failedIds: string[] }
}

async function runBulk(
  ids: string[],
  fn: (id: string) => Promise<void>,
): Promise<BulkResult> {
  const failedIds: string[] = []
  let updated = 0
  for (const id of ids) {
    try {
      await fn(id)
      updated += 1
    } catch (err) {
      console.error('[tasks/bulk]', id, err)
      failedIds.push(id)
    }
  }
  return { ok: true, data: { updated, failedIds } }
}

export async function bulkArchiveTasksAction(
  ids: string[],
): Promise<BulkResult> {
  const user = await requireAdmin()
  const result = await runBulk(ids, (id) =>
    taskService.archive(id, user.id).then(() => undefined),
  )
  revalidateAll()
  return result
}

export async function bulkDeleteTasksAction(
  ids: string[],
): Promise<BulkResult> {
  const user = await requireAdmin()
  const result = await runBulk(ids, (id) =>
    taskService.softDelete(id, user.id),
  )
  revalidateAll()
  return result
}

export async function bulkChangeStatusAction(
  ids: string[],
  statusId: string,
): Promise<BulkResult> {
  const user = await requireAdmin()
  const result = await runBulk(ids, (id) =>
    taskService.changeStatus(id, statusId, user.id).then(() => undefined),
  )
  revalidateAll()
  return result
}

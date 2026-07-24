'use server'

// Workflow admin actions for /admin/tasks/settings. Thin
// controllers over taskWorkflowAdminService — auth check, parse,
// dispatch, revalidate.

import { revalidatePath } from 'next/cache'

import { requireTeamModuleAccess } from '@/lib/auth/get-user'
import { writeAuditLog } from '@/lib/services/audit-log-service'
import {
  taskWorkflowAdminService,
  LastStatusError,
  StatusInUseError,
  type CategoryListItem,
  type LabelListItem,
  type StatusListItem,
} from '@/lib/services/task-workflow-service'
import {
  upsertCategorySchema,
  upsertLabelSchema,
  upsertStatusSchema,
} from '@/lib/validations/tasks'

// ============================================
// SHARED RESULT SHAPES
// ============================================

interface Ok<T = void> {
  ok: true
  data: T
}
interface Err {
  ok: false
  error?: string
  fieldErrors?: Record<string, string[]>
}
type Result<T = void> = Ok<T> | Err

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

function toErr(err: unknown, fallback: string): Err {
  if (err instanceof StatusInUseError || err instanceof LastStatusError) {
    return { ok: false, error: err.message }
  }
  console.error('[tasks/settings/actions]', fallback, err)
  const message = err instanceof Error ? err.message : fallback
  return { ok: false, error: message }
}

function revalidateAll(): void {
  revalidatePath('/admin/tasks/settings')
  revalidatePath('/admin/tasks')
}

// ============================================
// WORKSPACE FETCHER
// ============================================

export interface WorkflowSettingsPayload {
  statuses: StatusListItem[]
  categories: CategoryListItem[]
  labels: LabelListItem[]
}

export async function fetchWorkflowSettingsAction(): Promise<
  Result<WorkflowSettingsPayload>
> {
  await requireTeamModuleAccess('tasks')
  try {
    const [statuses, categories, labels] = await Promise.all([
      taskWorkflowAdminService.listStatuses(),
      taskWorkflowAdminService.listCategories(),
      taskWorkflowAdminService.listLabels(),
    ])
    return { ok: true, data: { statuses, categories, labels } }
  } catch (err) {
    return toErr(err, 'Could not load workflow settings')
  }
}

// ============================================
// STATUSES
// ============================================

export async function upsertStatusAction(
  input: Record<string, unknown>,
): Promise<Result<StatusListItem>> {
  const actor = await requireTeamModuleAccess('tasks')
  const parsed = upsertStatusSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }
  try {
    const data = await taskWorkflowAdminService.upsertStatus(parsed.data)
    await writeAuditLog({
      actorId: actor.id,
      action: parsed.data.id ? 'workflow.status.update' : 'workflow.status.create',
      resourceType: 'taskStatus',
      resourceId: data.id,
      summary: `${parsed.data.id ? 'Updated' : 'Created'} task status "${data.name}"`,
    })
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toErr(err, 'Could not save status')
  }
}

export async function deleteStatusAction(id: string): Promise<Result> {
  const actor = await requireTeamModuleAccess('tasks')
  try {
    await taskWorkflowAdminService.deleteStatus(id)
    await writeAuditLog({
      actorId: actor.id,
      action: 'workflow.status.delete',
      resourceType: 'taskStatus',
      resourceId: id,
      summary: `Deleted task status ${id}`,
    })
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toErr(err, 'Could not delete status')
  }
}

export async function reorderStatusesAction(
  ids: string[],
): Promise<Result> {
  const actor = await requireTeamModuleAccess('tasks')
  try {
    await taskWorkflowAdminService.reorderStatuses(ids)
    await writeAuditLog({
      actorId: actor.id,
      action: 'workflow.status.reorder',
      resourceType: 'taskStatus',
      resourceId: null,
      summary: `Reordered ${ids.length} task statuses`,
    })
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toErr(err, 'Could not reorder statuses')
  }
}

// ============================================
// CATEGORIES
// ============================================

export async function upsertCategoryAction(
  input: Record<string, unknown>,
): Promise<Result<CategoryListItem>> {
  const actor = await requireTeamModuleAccess('tasks')
  const parsed = upsertCategorySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }
  try {
    const data = await taskWorkflowAdminService.upsertCategory(parsed.data)
    await writeAuditLog({
      actorId: actor.id,
      action: parsed.data.id ? 'workflow.category.update' : 'workflow.category.create',
      resourceType: 'taskCategory',
      resourceId: data.id,
      summary: `${parsed.data.id ? 'Updated' : 'Created'} task category "${data.name}"`,
    })
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toErr(err, 'Could not save category')
  }
}

export async function deleteCategoryAction(id: string): Promise<Result> {
  const actor = await requireTeamModuleAccess('tasks')
  try {
    await taskWorkflowAdminService.deleteCategory(id)
    await writeAuditLog({
      actorId: actor.id,
      action: 'workflow.category.delete',
      resourceType: 'taskCategory',
      resourceId: id,
      summary: `Deleted task category ${id}`,
    })
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toErr(err, 'Could not delete category')
  }
}

// ============================================
// LABELS
// ============================================

export async function upsertLabelAction(
  input: Record<string, unknown>,
): Promise<Result<LabelListItem>> {
  const actor = await requireTeamModuleAccess('tasks')
  const parsed = upsertLabelSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }
  try {
    const data = await taskWorkflowAdminService.upsertLabel(parsed.data)
    await writeAuditLog({
      actorId: actor.id,
      action: parsed.data.id ? 'workflow.label.update' : 'workflow.label.create',
      resourceType: 'taskLabel',
      resourceId: data.id,
      summary: `${parsed.data.id ? 'Updated' : 'Created'} task label "${data.name}"`,
    })
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toErr(err, 'Could not save label')
  }
}

export async function deleteLabelAction(id: string): Promise<Result> {
  const actor = await requireTeamModuleAccess('tasks')
  try {
    await taskWorkflowAdminService.deleteLabel(id)
    await writeAuditLog({
      actorId: actor.id,
      action: 'workflow.label.delete',
      resourceType: 'taskLabel',
      resourceId: id,
      summary: `Deleted task label ${id}`,
    })
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toErr(err, 'Could not delete label')
  }
}

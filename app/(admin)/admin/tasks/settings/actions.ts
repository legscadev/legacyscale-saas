'use server'

// Workflow admin actions for /admin/tasks/settings. Thin
// controllers over taskWorkflowAdminService — auth check, parse,
// dispatch, revalidate.

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/auth/get-user'
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
  await requireAdmin()
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
  await requireAdmin()
  const parsed = upsertStatusSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }
  try {
    const data = await taskWorkflowAdminService.upsertStatus(parsed.data)
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toErr(err, 'Could not save status')
  }
}

export async function deleteStatusAction(id: string): Promise<Result> {
  await requireAdmin()
  try {
    await taskWorkflowAdminService.deleteStatus(id)
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toErr(err, 'Could not delete status')
  }
}

export async function reorderStatusesAction(
  ids: string[],
): Promise<Result> {
  await requireAdmin()
  try {
    await taskWorkflowAdminService.reorderStatuses(ids)
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
  await requireAdmin()
  const parsed = upsertCategorySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }
  try {
    const data = await taskWorkflowAdminService.upsertCategory(parsed.data)
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toErr(err, 'Could not save category')
  }
}

export async function deleteCategoryAction(id: string): Promise<Result> {
  await requireAdmin()
  try {
    await taskWorkflowAdminService.deleteCategory(id)
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
  await requireAdmin()
  const parsed = upsertLabelSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }
  try {
    const data = await taskWorkflowAdminService.upsertLabel(parsed.data)
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toErr(err, 'Could not save label')
  }
}

export async function deleteLabelAction(id: string): Promise<Result> {
  await requireAdmin()
  try {
    await taskWorkflowAdminService.deleteLabel(id)
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toErr(err, 'Could not delete label')
  }
}

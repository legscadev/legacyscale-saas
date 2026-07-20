'use server'

// Category-admin actions for /admin/policies/settings. Thin
// controllers over policyCategoryAdminService — auth → parse →
// dispatch → revalidate.

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/auth/get-user'
import {
  policyCategoryAdminService,
  type PolicyCategoryListItem,
} from '@/lib/services/policy-workspace-service'
import { upsertPolicyCategorySchema } from '@/lib/validations/policy'

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
  console.error('[policies/settings/actions]', fallback, err)
  const message = err instanceof Error ? err.message : fallback
  return { ok: false, error: message }
}

function revalidateAll(): void {
  revalidatePath('/admin/policies/settings')
  revalidatePath('/admin/policies')
}

export interface PolicySettingsPayload {
  categories: PolicyCategoryListItem[]
}

export async function fetchPolicySettingsAction(): Promise<
  Result<PolicySettingsPayload>
> {
  await requireAdmin()
  try {
    const categories = await policyCategoryAdminService.list()
    return { ok: true, data: { categories } }
  } catch (err) {
    return toErr(err, 'Could not load policy settings')
  }
}

export async function upsertPolicyCategoryAction(
  input: Record<string, unknown>,
): Promise<Result<PolicyCategoryListItem>> {
  await requireAdmin()
  const parsed = upsertPolicyCategorySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }
  try {
    const data = await policyCategoryAdminService.upsert(parsed.data)
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toErr(err, 'Could not save category')
  }
}

export async function deletePolicyCategoryAction(
  id: string,
): Promise<Result> {
  await requireAdmin()
  try {
    await policyCategoryAdminService.delete(id)
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toErr(err, 'Could not delete category')
  }
}

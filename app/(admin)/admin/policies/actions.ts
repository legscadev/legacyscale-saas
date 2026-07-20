'use server'

// Server actions for the Policies module. Every action is a thin
// controller: auth check → parse with Zod → hand off to a service →
// revalidate → return {ok, ...} or {ok:false, error, fieldErrors}.
//
// UI won't land until Phase 2+; these actions are wired now so the
// smoke test and any future UI callsite share one parse/dispatch
// layer.

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/auth/get-user'
import { prisma } from '@/lib/prisma'
import {
  policyActivityService,
  type PolicyActivityRow,
} from '@/lib/services/policy-activity-service'
import {
  policyAttachmentService,
  PolicyAttachmentNotFoundError,
  type PolicyAttachmentRow,
} from '@/lib/services/policy-attachment-service'
import {
  policyService,
  PolicyNotFoundError,
  RevisionMismatchError,
  type PolicyDetail,
  type PolicyListResult,
  type PolicyRevisionDetail,
  type PolicyRevisionRow,
} from '@/lib/services/policy-service'
import { ensurePolicyWorkspaceReady } from '@/lib/services/policy-workspace-service'
import { getRequestCompanyId } from '@/lib/tenancy/request-company'
import {
  addPolicyLinkAttachmentSchema,
  createPolicySchema,
  policyFilterSchema,
  publishPolicySchema,
  revertPolicySchema,
  updatePolicySchema,
  type CreatePolicyInput,
  type UpdatePolicyInput,
} from '@/lib/validations/policy'

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

function toMutationErr(err: unknown, fallback: string): MutationErr {
  if (
    err instanceof PolicyNotFoundError ||
    err instanceof PolicyAttachmentNotFoundError ||
    err instanceof RevisionMismatchError
  ) {
    return { ok: false, error: err.message }
  }
  console.error('[policies/actions]', fallback, err)
  const message = err instanceof Error ? err.message : fallback
  return { ok: false, error: message }
}

function revalidateAll(): void {
  revalidatePath('/admin/policies')
}

// ============================================
// READ
// ============================================

export type PolicyListPayload = PolicyListResult

/**
 * List policies for the current tenant. Runs the workspace-ready
 * check inline so first-time visits seed the default categories
 * before the list renders.
 */
export async function fetchPoliciesAction(
  filters: Record<string, unknown> = {},
): Promise<MutationResult<PolicyListPayload>> {
  await requireAdmin()
  const companyId = await getRequestCompanyId()
  if (companyId) await ensurePolicyWorkspaceReady(companyId)

  const parsed = policyFilterSchema.safeParse(filters)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  try {
    const data = await policyService.list(parsed.data)
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not load policies')
  }
}

export async function fetchPolicyAction(
  id: string,
): Promise<MutationResult<PolicyDetail>> {
  await requireAdmin()
  try {
    const data = await policyService.get(id)
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not load policy')
  }
}

/**
 * Bundled payload for the detail page — policy + revisions +
 * attachments + activity in one round trip so opening a doc doesn't
 * waterfall four independent fetches.
 */
export interface PolicyDetailPayload {
  policy: PolicyDetail
  revisions: PolicyRevisionRow[]
  attachments: PolicyAttachmentRow[]
  activity: PolicyActivityRow[]
}

export async function fetchPolicyDetailAction(
  id: string,
): Promise<MutationResult<PolicyDetailPayload>> {
  await requireAdmin()
  try {
    const [policy, revisions, attachments, activity] = await Promise.all([
      policyService.get(id),
      policyService.listRevisions(id),
      policyAttachmentService.listForPolicy(id),
      policyActivityService.listForPolicy(id, { limit: 100 }),
    ])
    return {
      ok: true,
      data: {
        policy,
        revisions,
        attachments,
        activity: activity.items,
      },
    }
  } catch (err) {
    return toMutationErr(err, 'Could not load policy')
  }
}

export async function fetchPolicyRevisionAction(
  revisionId: string,
): Promise<MutationResult<PolicyRevisionDetail>> {
  await requireAdmin()
  try {
    const data = await policyService.getRevision(revisionId)
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not load revision')
  }
}

// ============================================
// WORKSPACE FETCHER
// ============================================

export interface PolicyCategoryRef {
  id: string
  name: string
  color: string
}

/**
 * Everything the list shell needs on first render — categories +
 * the filtered policy list + the current viewer's id — in one
 * server-side round trip so pickers hydrate without a flash.
 * Filter parsing lives here so URL-driven refetches (client-side)
 * share the same code path.
 */
export interface PolicyWorkspacePayload {
  categories: PolicyCategoryRef[]
  policies: PolicyListResult
  currentUserId: string
}

export async function fetchPolicyWorkspaceAction(
  filters: Record<string, unknown> = {},
): Promise<MutationResult<PolicyWorkspacePayload>> {
  const currentUser = await requireAdmin()
  const companyId = await getRequestCompanyId()
  if (companyId) await ensurePolicyWorkspaceReady(companyId)

  const parsed = policyFilterSchema.safeParse(filters)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  try {
    const [categories, policies] = await Promise.all([
      prisma.policyCategory.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, color: true },
      }),
      policyService.list(parsed.data),
    ])
    return {
      ok: true,
      data: { categories, policies, currentUserId: currentUser.id },
    }
  } catch (err) {
    return toMutationErr(err, 'Could not load policy workspace')
  }
}

// ============================================
// WRITE — POLICY
// ============================================

export async function createPolicyAction(
  input: CreatePolicyInput,
): Promise<MutationResult<PolicyDetail>> {
  const user = await requireAdmin()
  const parsed = createPolicySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }
  try {
    const data = await policyService.create(parsed.data, user.id)
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not create policy')
  }
}

export async function updatePolicyAction(
  id: string,
  input: UpdatePolicyInput,
): Promise<MutationResult<PolicyDetail>> {
  const user = await requireAdmin()
  const parsed = updatePolicySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }
  try {
    const data = await policyService.update(id, parsed.data, user.id)
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not update policy')
  }
}

export async function publishPolicyAction(
  policyId: string,
): Promise<MutationResult<PolicyDetail>> {
  const user = await requireAdmin()
  const parsed = publishPolicySchema.safeParse({ policyId })
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }
  try {
    const data = await policyService.publish(parsed.data.policyId, user.id)
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not publish policy')
  }
}

export async function archivePolicyAction(
  policyId: string,
): Promise<MutationResult<PolicyDetail>> {
  const user = await requireAdmin()
  try {
    const data = await policyService.archive(policyId, user.id)
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not archive policy')
  }
}

export async function restorePolicyAction(
  policyId: string,
): Promise<MutationResult<PolicyDetail>> {
  const user = await requireAdmin()
  try {
    const data = await policyService.restore(policyId, user.id)
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not restore policy')
  }
}

export async function deletePolicyAction(
  policyId: string,
): Promise<MutationResult> {
  const user = await requireAdmin()
  try {
    await policyService.softDelete(policyId, user.id)
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toMutationErr(err, 'Could not delete policy')
  }
}

export async function revertPolicyAction(input: {
  policyId: string
  revisionId: string
}): Promise<MutationResult<PolicyDetail>> {
  const user = await requireAdmin()
  const parsed = revertPolicySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }
  try {
    const data = await policyService.revert(
      parsed.data.policyId,
      parsed.data.revisionId,
      user.id,
    )
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not revert policy')
  }
}

// ============================================
// WRITE — ATTACHMENTS
// ============================================

export async function uploadPolicyAttachmentAction(
  formData: FormData,
): Promise<MutationResult<PolicyAttachmentRow>> {
  const user = await requireAdmin()
  const policyId = String(formData.get('policyId') ?? '')
  const file = formData.get('file')
  if (!policyId) return { ok: false, error: 'Missing policyId' }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'No file provided' }
  }

  try {
    const data = await policyAttachmentService.upload({
      policyId,
      file,
      actorId: user.id,
    })
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not upload attachment')
  }
}

export async function addPolicyLinkAttachmentAction(input: {
  policyId: string
  name: string
  url: string
}): Promise<MutationResult<PolicyAttachmentRow>> {
  const user = await requireAdmin()
  const parsed = addPolicyLinkAttachmentSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }
  const url = parsed.data.url
  const parsedUrl = new URL(url)
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return { ok: false, error: 'URL must start with http:// or https://' }
  }

  try {
    const data = await policyAttachmentService.registerLink({
      policyId: parsed.data.policyId,
      name: parsed.data.name,
      url,
      actorId: user.id,
    })
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not add link')
  }
}

export async function deletePolicyAttachmentAction(
  attachmentId: string,
): Promise<MutationResult> {
  const user = await requireAdmin()
  try {
    await policyAttachmentService.delete(attachmentId, user.id)
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toMutationErr(err, 'Could not delete attachment')
  }
}

export async function signPolicyAttachmentUrlAction(
  attachmentId: string,
): Promise<MutationResult<{ url: string }>> {
  await requireAdmin()
  try {
    const url = await policyAttachmentService.signDownloadUrl(attachmentId)
    return { ok: true, data: { url } }
  } catch (err) {
    return toMutationErr(err, 'Could not sign download URL')
  }
}

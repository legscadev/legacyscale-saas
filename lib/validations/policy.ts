// Zod schemas for the Policies module.
//
// Policies are mostly title + rich-text body + category — much
// smaller surface than tasks. State transitions get their own
// schemas (publish, archive, restore, revert) so the actions can
// short-circuit without loading the full edit form.

import { z } from 'zod'

// ============================================
// SHARED PRIMITIVES
// ============================================

export const policyStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
export type PolicyStatusValue = z.infer<typeof policyStatusSchema>

export const POLICY_STATUS_LABELS: Record<PolicyStatusValue, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
}

/** Hard cap on rich-text body size. Tiptap HTML is chatty; 200KB
 *  is generous for a doc that maxes out around 10 pages of prose
 *  without eating the DB. */
const BODY_MAX = 200_000

// ============================================
// POLICY CRUD
// ============================================

/**
 * Create-policy payload. Only title is required — a fresh draft can
 * be created title-only and filled in after. body/category default
 * to null; status is always DRAFT on create (publish is a separate
 * transition).
 */
export const createPolicySchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  body: z.string().max(BODY_MAX).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
})
export type CreatePolicyInput = z.input<typeof createPolicySchema>
export type CreatePolicyOutput = z.output<typeof createPolicySchema>

/**
 * Partial update. Every field optional; explicit null clears the
 * value (body, category). Status transitions are NOT accepted here
 * — use publish / archive / restore actions.
 */
export const updatePolicySchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().max(BODY_MAX).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
})
export type UpdatePolicyInput = z.input<typeof updatePolicySchema>
export type UpdatePolicyOutput = z.output<typeof updatePolicySchema>

// ============================================
// STATE TRANSITIONS
// ============================================

/** Publish flips DRAFT → PUBLISHED, snapshots a PolicyRevision, and
 *  bumps `revision`. On re-publish (already PUBLISHED) the same
 *  transition applies — the caller has just edited the current body
 *  and wants a new revision cut. */
export const publishPolicySchema = z.object({
  policyId: z.string().uuid(),
})
export type PublishPolicyInput = z.input<typeof publishPolicySchema>

export const archivePolicySchema = z.object({
  policyId: z.string().uuid(),
})
export type ArchivePolicyInput = z.input<typeof archivePolicySchema>

export const restorePolicySchema = z.object({
  policyId: z.string().uuid(),
})
export type RestorePolicyInput = z.input<typeof restorePolicySchema>

/** Soft-delete. Reversible via restorePolicy which clears deletedAt. */
export const deletePolicySchema = z.object({
  policyId: z.string().uuid(),
})
export type DeletePolicyInput = z.input<typeof deletePolicySchema>

/** Revert copies a revision's title + body back onto the parent
 *  Policy AND cuts a new PolicyRevision from that snapshot so the
 *  timeline stays append-only. */
export const revertPolicySchema = z.object({
  policyId: z.string().uuid(),
  revisionId: z.string().uuid(),
})
export type RevertPolicyInput = z.input<typeof revertPolicySchema>

// ============================================
// FILTER / QUERY
// ============================================

/**
 * List-view filters. Arrays are OR'd within a facet, AND'd across
 * facets. `search` matches title ILIKE %q%; body is skipped because
 * HTML content produces noisy matches (tag names, style attrs).
 * Archived policies are hidden unless `includeArchived` is true.
 */
export const policyFilterSchema = z.object({
  search: z.string().trim().max(200).optional(),
  statuses: z.array(policyStatusSchema).optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  includeArchived: z.boolean().optional().default(false),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(50),
  sortBy: z
    .enum(['title', 'createdAt', 'updatedAt', 'publishedAt'])
    .default('title'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})
export type PolicyFilterInput = z.input<typeof policyFilterSchema>
export type PolicyFilterOutput = z.output<typeof policyFilterSchema>

// ============================================
// ATTACHMENTS
// ============================================

/**
 * Registered after the client uploads bytes to Supabase Storage.
 * The server verifies the storage path lives under the tenant's
 * prefix before writing the row. Link-style attachments (Google
 * Drive, Figma, Loom) use the link schema below.
 */
export const registerPolicyAttachmentSchema = z.object({
  policyId: z.string().uuid(),
  path: z.string().min(1).max(500),
  name: z.string().trim().min(1).max(255),
  mimeType: z.string().max(100),
  size: z.number().int().min(0).max(50 * 1024 * 1024),
})
export type RegisterPolicyAttachmentInput = z.input<
  typeof registerPolicyAttachmentSchema
>

export const addPolicyLinkAttachmentSchema = z.object({
  policyId: z.string().uuid(),
  name: z.string().trim().min(1).max(255),
  url: z.string().trim().url().max(2048),
})
export type AddPolicyLinkAttachmentInput = z.input<
  typeof addPolicyLinkAttachmentSchema
>

export const deletePolicyAttachmentSchema = z.object({
  attachmentId: z.string().uuid(),
})
export type DeletePolicyAttachmentInput = z.input<
  typeof deletePolicyAttachmentSchema
>

// ============================================
// WORKFLOW ADMIN (categories)
// ============================================

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

export const upsertPolicyCategorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(60),
  color: z.string().regex(HEX_COLOR, 'Color must be #RRGGBB'),
})
export type UpsertPolicyCategoryInput = z.input<
  typeof upsertPolicyCategorySchema
>

export const deletePolicyCategorySchema = z.object({
  id: z.string().uuid(),
})
export type DeletePolicyCategoryInput = z.input<
  typeof deletePolicyCategorySchema
>

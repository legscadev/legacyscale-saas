// Zod schemas for the CRM sales pipeline (P0 #1).
//
// Mirrors the Task Tracker's validation style: a create schema whose
// stageId is optional (service falls back to the pipeline's first
// stage), a move schema for Kanban drag-drop, and a permissive filter
// schema the board page encodes straight into the URL query string.
//
// Contact fields are free-text for P0 — they become crm_contact FKs
// in P0 #3, at which point contactName/companyName give way to
// contactId/companyId without touching the board.

import { z } from 'zod'

// ============================================
// SHARED PRIMITIVES
// ============================================

export const crmOpportunityStatusSchema = z.enum(['OPEN', 'WON', 'LOST'])
export type CrmOpportunityStatusValue = z.infer<
  typeof crmOpportunityStatusSchema
>

export const CRM_OPPORTUNITY_STATUS_LABELS: Record<
  CrmOpportunityStatusValue,
  string
> = {
  OPEN: 'Open',
  WON: 'Won',
  LOST: 'Lost',
}

/**
 * ISO date string / empty → Date | null. Local to the CRM module
 * (matches the tasks pattern) so the service always sees Date | null.
 */
const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || !Number.isNaN(new Date(v).getTime()), {
    message: 'Invalid date',
  })
  .transform((v) => (v === null ? null : new Date(v)))
  .nullable()

/** Optional 0–100 probability. Empty string / null clears it. */
const optionalProbability = z
  .number()
  .int()
  .min(0, 'Probability must be 0–100')
  .max(100, 'Probability must be 0–100')
  .nullable()
  .optional()

// ============================================
// OPPORTUNITY CRUD
// ============================================

/**
 * Create-deal payload. `stageId` is optional — the service drops the
 * card into the pipeline's first (lowest orderIndex) stage when
 * omitted, so a quick-add form only needs a name.
 */
export const createOpportunitySchema = z.object({
  name: z.string().trim().min(1, 'Deal name is required').max(200),
  pipelineId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  contactName: z.string().trim().max(200).nullable().optional(),
  contactEmail: z
    .string()
    .trim()
    .max(320)
    .email('Enter a valid email')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  contactPhone: z.string().trim().max(50).nullable().optional(),
  companyName: z.string().trim().max(200).nullable().optional(),
  value: z.number().min(0).max(1_000_000_000).nullable().optional(),
  probability: optionalProbability,
  expectedCloseDate: optionalDate.optional(),
  assignedCloserId: z.string().uuid().nullable().optional(),
  notes: z.string().max(20000).nullable().optional(),
})
export type CreateOpportunityInput = z.input<typeof createOpportunitySchema>
export type CreateOpportunityOutput = z.output<typeof createOpportunitySchema>

/**
 * Partial update. Every field optional; explicit null clears the
 * value (dates, contact, value, closer).
 */
export const updateOpportunitySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  contactName: z.string().trim().max(200).nullable().optional(),
  contactEmail: z
    .string()
    .trim()
    .max(320)
    .email('Enter a valid email')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  contactPhone: z.string().trim().max(50).nullable().optional(),
  companyName: z.string().trim().max(200).nullable().optional(),
  value: z.number().min(0).max(1_000_000_000).nullable().optional(),
  probability: optionalProbability,
  expectedCloseDate: optionalDate.optional(),
  assignedCloserId: z.string().uuid().nullable().optional(),
  notes: z.string().max(20000).nullable().optional(),
})
export type UpdateOpportunityInput = z.input<typeof updateOpportunitySchema>
export type UpdateOpportunityOutput = z.output<typeof updateOpportunitySchema>

/**
 * Kanban drag-drop payload. `orderIndex` is the pre-computed target
 * position from the board's optimistic move; omitted for programmatic
 * moves (service appends to the column tail).
 */
export const moveOpportunitySchema = z.object({
  opportunityId: z.string().uuid(),
  stageId: z.string().uuid(),
  orderIndex: z.number().int().optional(),
})
export type MoveOpportunityInput = z.input<typeof moveOpportunitySchema>

// ============================================
// FILTERS (URL-encoded on the board page)
// ============================================

// ============================================
// PIPELINE CRUD
// ============================================

export const createPipelineSchema = z.object({
  name: z.string().trim().min(1, 'Pipeline name is required').max(100),
  stageNames: z
    .array(z.string().trim().min(1).max(60))
    .min(1, 'Add at least one stage')
    .max(30, 'Too many stages'),
})
export type CreatePipelineInput = z.input<typeof createPipelineSchema>

export const renamePipelineSchema = z.object({
  pipelineId: z.string().uuid(),
  name: z.string().trim().min(1, 'Pipeline name is required').max(100),
})

// ============================================
// FILTERS (URL-encoded on the board page)
// ============================================

export const opportunityFilterSchema = z.object({
  pipelineId: z.string().uuid().optional(),
  search: z.string().trim().max(200).optional(),
  assigneeIds: z.array(z.string().uuid()).max(50).optional().default([]),
  status: crmOpportunityStatusSchema.optional(),
  /** Team-surface convenience: restrict to the viewer's own deals.
   *  Folded into assigneeIds server-side (the action has the user id). */
  mine: z.boolean().optional().default(false),
})
export type OpportunityFilterInput = z.input<typeof opportunityFilterSchema>
export type OpportunityFilterOutput = z.output<typeof opportunityFilterSchema>

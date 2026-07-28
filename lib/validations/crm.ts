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
  name: z.string().trim().min(1, 'Opportunity name is required').max(200),
  pipelineId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  status: crmOpportunityStatusSchema.optional(),
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

export const reorderPipelinesSchema = z.object({
  pipelineIds: z.array(z.string().uuid()).min(1),
})

export const duplicatePipelineSchema = z.object({
  sourcePipelineId: z.string().uuid(),
  name: z.string().trim().min(1, 'Pipeline name is required').max(100),
})

// ---- Bulk actions ----

export const crmBulkActionStatusSchema = z.enum([
  'RUNNING',
  'COMPLETE',
  'FAILED',
])
export const crmBulkActionOperationSchema = z.enum([
  'DELETE',
  'MOVE_STAGE',
  'ASSIGN_CLOSER',
])

/** Bulk-delete input — capped at 500 so a single click can't take out
 *  a whole tenant. The board's toolbar surfaces this ceiling. */
export const bulkDeleteOpportunitiesSchema = z.object({
  opportunityIds: z
    .array(z.string().uuid())
    .min(1, 'Select at least one deal')
    .max(500, 'You can delete at most 500 deals at once'),
})

/** Bulk move-to-stage — same 500 cap as delete. */
export const bulkMoveOpportunitiesSchema = z.object({
  opportunityIds: z
    .array(z.string().uuid())
    .min(1, 'Select at least one deal')
    .max(500, 'You can move at most 500 deals at once'),
  stageId: z.string().uuid('Pick a destination stage'),
})

/** Bulk assign-closer — closerId nullable for the "unassign all" case. */
export const bulkAssignCloserSchema = z.object({
  opportunityIds: z
    .array(z.string().uuid())
    .min(1, 'Select at least one deal')
    .max(500, 'You can assign at most 500 deals at once'),
  closerId: z.string().uuid().nullable(),
})

// ---- CSV import ----

const shortText = (max: number) =>
  z.string().trim().max(max).nullable().optional()

const optionalEmail = z
  .string()
  .trim()
  .max(320)
  .email('Enter a valid email')
  .nullable()
  .optional()
  .or(z.literal('').transform(() => null))

/** One parsed opportunity CSV row. Everything except name is optional. */
export const csvOpportunitySchema = z.object({
  name: z.string().trim().min(1).max(200),
  contactName: shortText(200),
  contactEmail: optionalEmail,
  contactPhone: shortText(50),
  companyName: shortText(200),
  value: z.number().min(0).max(1_000_000_000).nullable().optional(),
  probability: z.number().int().min(0).max(100).nullable().optional(),
  /** Free-text stage name — resolved server-side against the target
   *  pipeline's stages (case-insensitive). Falls back to the first
   *  stage when omitted or unknown. */
  stageName: shortText(60),
})
export type CsvOpportunityRow = z.output<typeof csvOpportunitySchema>

export const importOpportunitiesSchema = z.object({
  pipelineId: z.string().uuid(),
  rows: z.array(csvOpportunitySchema).min(1, 'No rows to import').max(2000),
  assignedCloserId: z.string().uuid().nullable().optional(),
})

// ---- Saved filter views ----

/** Shape of a persisted filter set. Kept permissive — the client
 *  passes the full OpportunityFilterState in and we hand it back
 *  as-is when the view is loaded. Bad fields are silently dropped. */
export const opportunityViewFilterSchema = z
  .object({
    stageIds: z.array(z.string()).default([]),
    statuses: z.array(z.enum(['OPEN', 'WON', 'LOST'])).default([]),
    assigneeIds: z.array(z.string()).default([]),
    valueMin: z.string().default(''),
    valueMax: z.string().default(''),
    closeDateFrom: z.string().default(''),
    closeDateTo: z.string().default(''),
  })
  .passthrough()

export const createOpportunityViewSchema = z.object({
  name: z.string().trim().min(1, 'View name is required').max(80),
  filter: opportunityViewFilterSchema,
})

export const renameOpportunityViewSchema = z.object({
  viewId: z.string().uuid(),
  name: z.string().trim().min(1, 'View name is required').max(80),
})

export const updateOpportunityViewFilterSchema = z.object({
  viewId: z.string().uuid(),
  filter: opportunityViewFilterSchema,
})

export const bulkActionHistoryFilterSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  statuses: z.array(crmBulkActionStatusSchema).optional(),
  operations: z.array(crmBulkActionOperationSchema).optional(),
  actorIds: z.array(z.string().uuid()).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(200).default(50),
})

// ---- Stage editor ----

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #3b82f6')

const stageProbability = z
  .number()
  .int()
  .min(0)
  .max(100)
  .nullable()
  .optional()

export const addStageSchema = z.object({
  pipelineId: z.string().uuid(),
  name: z.string().trim().min(1, 'Stage name is required').max(60),
  color: hexColor.optional(),
  probability: stageProbability,
  isWon: z.boolean().optional(),
  isLost: z.boolean().optional(),
})
export type AddStageInput = z.input<typeof addStageSchema>

export const updateStageSchema = z.object({
  stageId: z.string().uuid(),
  name: z.string().trim().min(1).max(60).optional(),
  color: hexColor.optional(),
  probability: stageProbability,
  isWon: z.boolean().optional(),
  isLost: z.boolean().optional(),
  wipLimit: z.number().int().min(0).max(9999).nullable().optional(),
})
export type UpdateStageInput = z.input<typeof updateStageSchema>

export const reorderStagesSchema = z.object({
  pipelineId: z.string().uuid(),
  stageIds: z.array(z.string().uuid()).min(1),
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

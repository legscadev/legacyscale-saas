// Zod schemas for the CRM Leads module (P0 #2).
//
// A lead is the raw top-of-funnel row. Only fullName is required so
// a quick-add (or a sparse CSV row) can land; everything else is
// optional. Email is normalised to null when blank so the dedupe
// index doesn't collect empty strings.

import { z } from 'zod'

// ============================================
// ENUMS + LABELS
// ============================================

export const crmLeadSourceSchema = z.enum([
  'WEBSITE_FORM',
  'LANDING_PAGE',
  'FACEBOOK_ADS',
  'GOOGLE_ADS',
  'CSV_IMPORT',
  'MANUAL',
  'API',
  'WEBHOOK',
  'OTHER',
])
export type CrmLeadSourceValue = z.infer<typeof crmLeadSourceSchema>

export const CRM_LEAD_SOURCE_LABELS: Record<CrmLeadSourceValue, string> = {
  WEBSITE_FORM: 'Website form',
  LANDING_PAGE: 'Landing page',
  FACEBOOK_ADS: 'Facebook Ads',
  GOOGLE_ADS: 'Google Ads',
  CSV_IMPORT: 'CSV import',
  MANUAL: 'Manual entry',
  API: 'API',
  WEBHOOK: 'Webhook',
  OTHER: 'Other',
}

export const crmLeadStatusSchema = z.enum([
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'UNQUALIFIED',
  'CONVERTED',
])
export type CrmLeadStatusValue = z.infer<typeof crmLeadStatusSchema>

export const CRM_LEAD_STATUS_LABELS: Record<CrmLeadStatusValue, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  UNQUALIFIED: 'Unqualified',
  CONVERTED: 'Converted',
}

/** Status → pill colour (hex), reused by the table + filters. */
export const CRM_LEAD_STATUS_COLORS: Record<CrmLeadStatusValue, string> = {
  NEW: '#3b82f6',
  CONTACTED: '#f59e0b',
  QUALIFIED: '#0ea5e9',
  UNQUALIFIED: '#94a3b8',
  CONVERTED: '#22c55e',
}

// ============================================
// SHARED FIELD RULES
// ============================================

/** Optional email → null when blank; validated otherwise. */
const optionalEmail = z
  .string()
  .trim()
  .max(320)
  .email('Enter a valid email')
  .nullable()
  .optional()
  .or(z.literal('').transform(() => null))

const shortText = (max = 200) =>
  z.string().trim().max(max).nullable().optional()

// ============================================
// LEAD CRUD
// ============================================

export const createLeadSchema = z.object({
  fullName: z.string().trim().min(1, 'Name is required').max(200),
  email: optionalEmail,
  phone: shortText(50),
  secondaryPhone: shortText(50),
  companyName: shortText(200),
  address: shortText(500),
  source: crmLeadSourceSchema.optional().default('MANUAL'),
  campaign: shortText(200),
  industry: shortText(500),
  status: crmLeadStatusSchema.optional().default('NEW'),
  assignedSetterId: z.string().uuid().nullable().optional(),
  notes: z.string().max(20000).nullable().optional(),
})
export type CreateLeadInput = z.input<typeof createLeadSchema>
export type CreateLeadOutput = z.output<typeof createLeadSchema>

export const updateLeadSchema = z.object({
  fullName: z.string().trim().min(1).max(200).optional(),
  email: optionalEmail,
  phone: shortText(50),
  secondaryPhone: shortText(50),
  companyName: shortText(200),
  address: shortText(500),
  source: crmLeadSourceSchema.optional(),
  campaign: shortText(200),
  industry: shortText(500),
  assignedSetterId: z.string().uuid().nullable().optional(),
  notes: z.string().max(20000).nullable().optional(),
})
export type UpdateLeadInput = z.input<typeof updateLeadSchema>
export type UpdateLeadOutput = z.output<typeof updateLeadSchema>

export const changeLeadStatusSchema = z.object({
  leadId: z.string().uuid(),
  status: crmLeadStatusSchema,
})

export const assignLeadSchema = z.object({
  leadId: z.string().uuid(),
  setterId: z.string().uuid().nullable(),
})

/**
 * Convert a qualified lead into a pipeline deal. pipelineId / stageId
 * are optional (service falls back to the default pipeline + its
 * first stage); value + closer let the converter seed the deal.
 */
export const convertLeadSchema = z.object({
  leadId: z.string().uuid(),
  pipelineId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  value: z.number().min(0).max(1_000_000_000).nullable().optional(),
  assignedCloserId: z.string().uuid().nullable().optional(),
})
export type ConvertLeadInput = z.input<typeof convertLeadSchema>
export type ConvertLeadOutput = z.output<typeof convertLeadSchema>

// ============================================
// FILTERS + BULK IMPORT
// ============================================

const csv = (v: unknown) => (Array.isArray(v) ? v : v === undefined ? [] : [v])

/** ISO date string / empty → Date | null. Used by the created/
 *  lastActivity date-range filters below. */
const optionalDateFilter = z
  .string()
  .trim()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || !Number.isNaN(new Date(v).getTime()), {
    message: 'Invalid date',
  })
  .transform((v) => (v === null ? null : new Date(v)))
  .nullable()
  .optional()

export const leadFilterSchema = z.object({
  search: z.string().trim().max(200).optional(),
  statuses: z.preprocess(csv, z.array(crmLeadStatusSchema)).optional().default([]),
  sources: z.preprocess(csv, z.array(crmLeadSourceSchema)).optional().default([]),
  assigneeIds: z
    .preprocess(csv, z.array(z.string().uuid()))
    .optional()
    .default([]),
  mine: z.boolean().optional().default(false),
  /** GHL-style: Contacts is the master list. Show every non-deleted
   *  row by default; the status filter above lets users narrow to
   *  just non-converted (still-leads) when they want the pre-P0 #3
   *  inbox view. */
  includeConverted: z.boolean().optional().default(true),
  /** Narrows to rows with (or without) contact channels — surfaces
   *  the "cleanup: contacts missing email" view in GHL. */
  hasEmail: z.boolean().optional(),
  hasPhone: z.boolean().optional(),
  /** Company-name substring; complementary to `search` which hits
   *  many fields — this one is a single-field filter. */
  companyName: z.string().trim().max(200).optional(),
  createdFrom: optionalDateFilter,
  createdTo: optionalDateFilter,
  lastActivityFrom: optionalDateFilter,
  lastActivityTo: optionalDateFilter,
  sortBy: z
    .enum([
      'createdAt',
      'lastActivityAt',
      'fullName',
      'status',
      'email',
      'phone',
      'companyName',
    ])
    .optional()
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
})
export type LeadFilterInput = z.input<typeof leadFilterSchema>
export type LeadFilterOutput = z.output<typeof leadFilterSchema>

// ---- Smart Lists (saved contact views) ----

/** Shape of a persisted Contacts smart-list filter blob. Kept
 *  permissive — extra keys the client stores (per-page, column
 *  visibility) round-trip untouched. Bad values are silently
 *  dropped by passthrough. */
export const contactViewFilterSchema = z
  .object({
    statuses: z.array(crmLeadStatusSchema).default([]),
    sources: z.array(crmLeadSourceSchema).default([]),
    assigneeIds: z.array(z.string()).default([]),
    companyName: z.string().default(''),
    hasEmail: z.union([z.boolean(), z.null()]).default(null),
    hasPhone: z.union([z.boolean(), z.null()]).default(null),
    createdFrom: z.string().default(''),
    createdTo: z.string().default(''),
    lastActivityFrom: z.string().default(''),
    lastActivityTo: z.string().default(''),
    search: z.string().default(''),
    sortBy: z.string().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    perPage: z.number().int().min(1).max(200).optional(),
  })
  .passthrough()

export const createContactViewSchema = z.object({
  name: z.string().trim().min(1, 'View name is required').max(80),
  filter: contactViewFilterSchema,
})

export const renameContactViewSchema = z.object({
  viewId: z.string().uuid(),
  name: z.string().trim().min(1, 'View name is required').max(80),
})

export const updateContactViewFilterSchema = z.object({
  viewId: z.string().uuid(),
  filter: contactViewFilterSchema,
})

/** One parsed CSV row. Same permissive shape as a manual create,
 *  minus the fields a spreadsheet won't carry. */
export const csvLeadRowSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  email: optionalEmail,
  phone: shortText(50),
  companyName: shortText(200),
  industry: shortText(500),
  campaign: shortText(200),
})
export type CsvLeadRow = z.output<typeof csvLeadRowSchema>

/** Import behaviour chosen in the wizard's Upload step. Shared
 *  between contacts and opportunities imports (the two shells wire
 *  the same three-way dropdown). */
export const importModeSchema = z.enum([
  'CREATE_ONLY',
  'CREATE_OR_UPDATE',
  'UPDATE_ONLY',
])
export type ImportMode = z.output<typeof importModeSchema>

export const importLeadsSchema = z.object({
  rows: z.array(csvLeadRowSchema).min(1, 'No rows to import').max(2000),
  assignedSetterId: z.string().uuid().nullable().optional(),
  mode: importModeSchema.optional().default('CREATE_ONLY'),
  fileName: z.string().trim().max(200).optional(),
  fileSize: z.number().int().min(0).optional(),
})
export type ImportLeadsInput = z.input<typeof importLeadsSchema>
export type ImportLeadsOutput = z.output<typeof importLeadsSchema>

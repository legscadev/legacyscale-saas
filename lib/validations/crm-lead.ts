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
  industry: shortText(120),
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
  industry: shortText(120),
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

export const leadFilterSchema = z.object({
  search: z.string().trim().max(200).optional(),
  statuses: z.preprocess(csv, z.array(crmLeadStatusSchema)).optional().default([]),
  sources: z.preprocess(csv, z.array(crmLeadSourceSchema)).optional().default([]),
  assigneeIds: z
    .preprocess(csv, z.array(z.string().uuid()))
    .optional()
    .default([]),
  mine: z.boolean().optional().default(false),
  includeConverted: z.boolean().optional().default(false),
  sortBy: z
    .enum(['createdAt', 'lastActivityAt', 'fullName', 'status'])
    .optional()
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
})
export type LeadFilterInput = z.input<typeof leadFilterSchema>
export type LeadFilterOutput = z.output<typeof leadFilterSchema>

/** One parsed CSV row. Same permissive shape as a manual create,
 *  minus the fields a spreadsheet won't carry. */
export const csvLeadRowSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  email: optionalEmail,
  phone: shortText(50),
  companyName: shortText(200),
  industry: shortText(120),
  campaign: shortText(200),
})
export type CsvLeadRow = z.output<typeof csvLeadRowSchema>

export const importLeadsSchema = z.object({
  rows: z.array(csvLeadRowSchema).min(1, 'No rows to import').max(2000),
  assignedSetterId: z.string().uuid().nullable().optional(),
})
export type ImportLeadsInput = z.input<typeof importLeadsSchema>
export type ImportLeadsOutput = z.output<typeof importLeadsSchema>

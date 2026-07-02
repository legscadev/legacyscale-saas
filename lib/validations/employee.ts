import { z } from 'zod'

export const employmentStatusSchema = z.enum(['ACTIVE', 'OFFBOARDED'])
export type EmploymentStatusValue = z.infer<typeof employmentStatusSchema>

export const checklistItemStatusSchema = z.enum([
  'OK',
  'PENDING',
  'ATTENTION',
  'NA',
])
export type ChecklistItemStatusValue = z.infer<typeof checklistItemStatusSchema>

export const CHECKLIST_STATUS_LABELS: Record<ChecklistItemStatusValue, string> = {
  OK: 'Done',
  PENDING: 'Pending',
  ATTENTION: 'Needs attention',
  NA: 'N/A',
}

/**
 * Accepts either an ISO date string ("2026-01-08"), a datetime string,
 * or an empty string. Empty maps to null so form inputs can clear a
 * previously-set date without special-casing.
 */
const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v ? v : null))
  .refine(
    (v) => v === null || !Number.isNaN(new Date(v).getTime()),
    { message: 'Invalid date' },
  )
  .transform((v) => (v === null ? null : new Date(v)))
  .nullable()

export const createEmployeeSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  roleTitle: z.string().trim().min(1, 'Role is required').max(120),
  onboardingDate: optionalDate.optional(),
  dateStarted: optionalDate.optional(),
  templateSlug: z.string().trim().min(1).max(80).nullable().optional(),
})
/**
 * Input shape callers pass (dates as strings/null). The transformed
 * output — with Date objects — lives on the service layer, hidden
 * behind the action wrapper.
 */
export type CreateEmployeeInput = z.input<typeof createEmployeeSchema>

export const updateEmployeeSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  roleTitle: z.string().trim().min(1).max(120).optional(),
  onboardingDate: optionalDate.optional(),
  dateStarted: optionalDate.optional(),
  notes: z.string().max(4000).nullable().optional(),
})
export type UpdateEmployeeInput = z.input<typeof updateEmployeeSchema>

export const offboardEmployeeSchema = z.object({
  offboardingDate: optionalDate.refine((v) => v !== null, {
    message: 'Offboarding date is required',
  }),
  notes: z.string().max(4000).nullable().optional(),
})
export type OffboardEmployeeInput = z.input<typeof offboardEmployeeSchema>

export const updateChecklistItemSchema = z.object({
  status: checklistItemStatusSchema,
  note: z.string().max(1000).nullable().optional(),
})
export type UpdateChecklistItemInput = z.input<typeof updateChecklistItemSchema>

// ---------------------------------------------------------------------
// Checklist template CRUD
// ---------------------------------------------------------------------

export const createTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  description: z.string().max(1000).nullable().optional(),
  isDefault: z.boolean().optional(),
})
export type CreateTemplateInput = z.input<typeof createTemplateSchema>

export const updateTemplateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().max(1000).nullable().optional(),
  isDefault: z.boolean().optional(),
})
export type UpdateTemplateInput = z.input<typeof updateTemplateSchema>

export const addTemplateItemSchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(120),
  description: z.string().max(500).nullable().optional(),
})
export type AddTemplateItemInput = z.input<typeof addTemplateItemSchema>

export const updateTemplateItemSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
})
export type UpdateTemplateItemInput = z.input<typeof updateTemplateItemSchema>

export const moveTemplateItemSchema = z.object({
  targetIndex: z.number().int().min(0),
})
export type MoveTemplateItemInput = z.input<typeof moveTemplateItemSchema>

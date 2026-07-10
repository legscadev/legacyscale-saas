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

/**
 * Which SaaS role a new employee gets when `grantAccess` is on.
 * Restricted to ADMIN and TEAM — this is the internal onboarding
 * flow, not a customer signup path, so MEMBER is intentionally
 * omitted.
 */
export const employeeAccessRoleSchema = z.enum(['ADMIN', 'TEAM'])
export type EmployeeAccessRoleValue = z.infer<typeof employeeAccessRoleSchema>

export const EMPLOYEE_ACCESS_ROLE_LABELS: Record<EmployeeAccessRoleValue, string> = {
  ADMIN: 'Admin',
  TEAM: 'Internal team',
}

export const createEmployeeSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(120),
    roleTitle: z.string().trim().min(1, 'Role is required').max(120),
    onboardingDate: optionalDate.optional(),
    dateStarted: optionalDate.optional(),
    // Free-form context field parallel to the Edit dialog's Notes.
    // Optional on create so pre-existing callers keep working.
    notes: z.string().max(4000).nullable().optional(),
    /**
     * When true, the admin also wants this hire to have SaaS login
     * access — we'll create a User account with `accessRole`, issue
     * an Invite, and email the link. `email` is required in that
     * case.
     */
    grantAccess: z.boolean().optional().default(false),
    /**
     * SaaS role for the newly-provisioned account. Defaults to TEAM
     * (internal-team access, no admin surface). Ignored when
     * `grantAccess` is false.
     */
    accessRole: employeeAccessRoleSchema.optional().default('TEAM'),
    /**
     * The login email. Only required when `grantAccess` is true;
     * ignored otherwise. Not `.email()` here so the refine below can
     * give a friendlier "Email is required for system access" error
     * when grantAccess=true and the field is empty.
     */
    email: z.string().trim().optional(),
    /**
     * Link to an existing User instead of creating a fresh account.
     * Mutually exclusive with `grantAccess`.
     */
    linkUserId: z.string().uuid().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.grantAccess && data.linkUserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['linkUserId'],
        message:
          'Pick either an existing user or create a new one, not both',
      })
    }
    if (!data.grantAccess) return
    const email = data.email?.trim() ?? ''
    if (!email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['email'],
        message: 'Email is required to grant system access',
      })
      return
    }
    if (!z.string().email().safeParse(email).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['email'],
        message: 'Invalid email address',
      })
    }
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
// Single-checklist item CRUD (no template scope anymore)
// ---------------------------------------------------------------------

export const addChecklistItemSchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(120),
  description: z.string().max(500).nullable().optional(),
})
export type AddChecklistItemInput = z.input<typeof addChecklistItemSchema>

export const updateChecklistItemFieldsSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
})
export type UpdateChecklistItemFieldsInput = z.input<
  typeof updateChecklistItemFieldsSchema
>

export const moveChecklistItemSchema = z.object({
  targetIndex: z.number().int().min(0),
})
export type MoveChecklistItemInput = z.input<typeof moveChecklistItemSchema>

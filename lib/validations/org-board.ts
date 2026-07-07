import { z } from 'zod'

export const orgNodeKindSchema = z.enum([
  'CROWN',
  'DIVISION',
  'DEPARTMENT',
  'SECTION',
  'UNIT',
  'POSITION',
])
export type OrgNodeKindValue = z.infer<typeof orgNodeKindSchema>

export const ORG_NODE_KIND_LABELS: Record<OrgNodeKindValue, string> = {
  CROWN: 'Crown',
  DIVISION: 'Division',
  DEPARTMENT: 'Department',
  SECTION: 'Section',
  UNIT: 'Unit',
  POSITION: 'Position',
}

export const orgNodeAssignmentSchema = z
  .object({
    /** Employee.id if assigning a real person. */
    employeeId: z.string().uuid().nullable().optional(),
    /** Free-text placeholder (e.g. "To be hired"). */
    freeTextHolder: z.string().max(120).nullable().optional(),
  })
  .refine(
    (v) => !(v.employeeId && v.freeTextHolder),
    { message: 'Pick either an employee or a placeholder, not both' },
  )

/** Free-form string list (KPIs, responsibilities, requirements). */
const stringListSchema = z
  .array(z.string().trim().min(1).max(500))
  .max(50)

export const createOrgNodeSchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  kind: orgNodeKindSchema,
  label: z.string().trim().min(1, 'Label is required').max(200),
  positionTitle: z.string().trim().max(120).nullable().optional(),
  deptNumber: z.number().int().min(1).max(999).nullable().optional(),
  color: z.string().max(30).nullable().optional(),
  vfp: z.string().max(2000).nullable().optional(),
  functionText: z.string().max(4000).nullable().optional(),
  responsibilities: stringListSchema.optional(),
  notes: z.string().max(4000).nullable().optional(),
  employeeId: z.string().uuid().nullable().optional(),
  freeTextHolder: z.string().max(120).nullable().optional(),
})
export type CreateOrgNodeInput = z.input<typeof createOrgNodeSchema>

export const updateOrgNodeSchema = z.object({
  label: z.string().trim().min(1).max(200).optional(),
  positionTitle: z.string().trim().max(120).nullable().optional(),
  deptNumber: z.number().int().min(1).max(999).nullable().optional(),
  color: z.string().max(30).nullable().optional(),
  vfp: z.string().max(2000).nullable().optional(),
  functionText: z.string().max(4000).nullable().optional(),
  responsibilities: stringListSchema.optional(),
  notes: z.string().max(4000).nullable().optional(),
  employeeId: z.string().uuid().nullable().optional(),
  freeTextHolder: z.string().max(120).nullable().optional(),
})
export type UpdateOrgNodeInput = z.input<typeof updateOrgNodeSchema>

export const employmentTypeSchema = z.enum([
  'FULL_TIME',
  'PART_TIME',
  'CONTRACT',
  'INTERN',
  'ADVISORY',
])
export type EmploymentTypeValue = z.infer<typeof employmentTypeSchema>

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentTypeValue, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
  INTERN: 'Intern',
  ADVISORY: 'Advisory',
}

export const addPositionAssignmentSchema = z.object({
  employeeId: z.string().uuid(),
  employmentType: employmentTypeSchema.nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
})
export type AddPositionAssignmentInput = z.input<typeof addPositionAssignmentSchema>

export const moveOrgNodeSchema = z.object({
  /**
   * "up"/"down" swap with the sibling above/below in orderIndex.
   * "left"/"right" are alises used on the top-level chart where
   * siblings render as columns rather than rows — semantics are
   * identical.
   */
  direction: z.enum(['up', 'down', 'left', 'right']),
})
export type MoveOrgNodeInput = z.input<typeof moveOrgNodeSchema>

import { z } from 'zod'

// Slug rules match the store: lowercase alnum + hyphens, no leading
// or trailing hyphen. We accept mixed-case + underscores on input and
// let createCompany() normalise them, but reject anything with spaces
// or punctuation on the wire so the error surfaces immediately.
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const createCompanySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  slug: z
    .string()
    .trim()
    .min(2, 'Slug must be at least 2 characters')
    .max(60)
    .regex(slugRegex, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  isAgency: z.boolean().optional().default(false),
  /**
   * Blank ownerEmail means "the creator (a super-admin) becomes the
   * OWNER". The action fills in the caller's email server-side in
   * that case, so this stays optional on the wire. See
   * createCompanyAction in app/(super)/super/companies/actions.ts.
   */
  ownerEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email')
    .optional()
    .or(z.literal('')),
  ownerName: z.string().trim().max(120).optional().or(z.literal('')),
  /**
   * Optional source-tenant to snapshot content from at creation
   * time. Undefined / null / empty string means "start blank".
   */
  snapshotFromCompanyId: z.string().uuid().optional().or(z.literal('')),
  /**
   * Selective clone flags. Categories + Courses default true (matches
   * the historical behavior); everything else defaults false — the
   * operator opts in via checkboxes. Ignored when snapshotFromCompanyId
   * is blank.
   */
  snapshotIncludeMemberships: z.boolean().optional().default(true),
  snapshotIncludeCourses: z.boolean().optional().default(true),
  snapshotIncludeTrainings: z.boolean().optional().default(false),
  snapshotIncludeStatistics: z.boolean().optional().default(false),
  snapshotIncludeOrgBoard: z.boolean().optional().default(false),
  snapshotIncludeOnboardingChecklists: z.boolean().optional().default(false),
  snapshotIncludeMembers: z.boolean().optional().default(false),
  snapshotIncludeTeam: z.boolean().optional().default(false),
})

export type CreateCompanyInput = z.infer<typeof createCompanySchema>

export const snapshotCompanySchema = z.object({
  sourceCompanyId: z.string().uuid(),
  targetCompanyId: z.string().uuid(),
  includeMemberships: z.boolean().optional().default(true),
  includeCourses: z.boolean().optional().default(true),
  includeTrainings: z.boolean().optional().default(false),
  includeStatistics: z.boolean().optional().default(false),
  includeOrgBoard: z.boolean().optional().default(false),
  includeOnboardingChecklists: z.boolean().optional().default(false),
  includeMembers: z.boolean().optional().default(false),
  includeTeam: z.boolean().optional().default(false),
})

export type SnapshotCompanyInput = z.infer<typeof snapshotCompanySchema>

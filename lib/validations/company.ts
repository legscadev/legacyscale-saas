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
  ownerEmail: z.string().trim().toLowerCase().email('Enter a valid email'),
  ownerName: z.string().trim().max(120).optional().or(z.literal('')),
})

export type CreateCompanyInput = z.infer<typeof createCompanySchema>

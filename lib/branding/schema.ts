// Zod schema for the `Company.brand` JSON column.
//
// Storage: `companies.brand` on the tenants row. Reads pass through
// `getBranding()` (see get-branding.ts) which validates + merges
// against the Kondense defaults. Writes must validate through
// `brandingInputSchema` before hitting Prisma so we never persist a
// malformed blob.
//
// Every field is optional at the JSON layer — tenants may set only
// what they've customised, and the resolver back-fills the rest from
// the platform defaults. The resolved `Branding` type below is the
// fully-populated shape consumers actually work with.

import { z } from 'zod'

const hexColor = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, 'Must be a 6-digit hex color, e.g. #ff0000')

/** Everything a tenant can set on their brand. All fields optional
 *  — the resolver merges over `DEFAULT_BRANDING` for anything
 *  missing. Used to validate the JSON we save into `companies.brand`. */
export const brandingInputSchema = z.object({
  productName: z.string().min(1).max(60).optional(),
  logoUrl: z.string().url().optional(),
  logoDarkUrl: z.string().url().optional(),
  faviconUrl: z.string().url().optional(),
  ogImageUrl: z.string().url().optional(),
  primaryColor: hexColor.optional(),
  accentColor: hexColor.optional(),
  supportEmail: z.string().email().optional(),
  supportUrl: z.string().url().optional(),
  fromName: z.string().max(60).optional(),
  legalCompany: z.string().max(120).optional(),
  tagline: z.string().max(160).optional(),
  privacyUrl: z.string().url().optional(),
  termsUrl: z.string().url().optional(),
})

/** Fully-resolved branding — every field required. This is what
 *  consumers (BrandMark, root metadata, later PDFs/emails) receive. */
export const brandingSchema = brandingInputSchema.required({
  productName: true,
  logoUrl: true,
  primaryColor: true,
  supportEmail: true,
  fromName: true,
  legalCompany: true,
})

export type BrandingInput = z.infer<typeof brandingInputSchema>
export type Branding = z.infer<typeof brandingSchema>

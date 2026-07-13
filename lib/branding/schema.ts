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

/** Font family choice. Values are chosen so that they map 1:1 to a
 *  CSS font-family stack in `app/layout.tsx`. Keep the list small —
 *  every webfont costs bundle size. */
export const FONT_FAMILY_VALUES = ['inter', 'system', 'serif'] as const
export type FontFamily = (typeof FONT_FAMILY_VALUES)[number]

/** Border-radius scale. Applied to shadcn's `--radius` CSS var. */
export const BORDER_RADIUS_VALUES = ['sharp', 'default', 'rounded'] as const
export type BorderRadius = (typeof BORDER_RADIUS_VALUES)[number]

/** Button treatment. Combines with borderRadius to produce the final
 *  button shape. */
export const BUTTON_STYLE_VALUES = ['default', 'sharp', 'pill'] as const
export type ButtonStyle = (typeof BUTTON_STYLE_VALUES)[number]

/** Everything a tenant can set on their brand. All fields optional
 *  — the resolver merges over `DEFAULT_BRANDING` for anything
 *  missing. Used to validate the JSON we save into `companies.brand`. */
export const brandingInputSchema = z.object({
  // ── Identity ─────────────────────────────────
  productName: z.string().min(1).max(60).optional(),
  tagline: z.string().max(160).optional(),
  supportEmail: z.string().email().optional(),
  supportUrl: z.string().url().optional(),
  fromName: z.string().max(60).optional(),
  legalCompany: z.string().max(120).optional(),
  privacyUrl: z.string().url().optional(),
  termsUrl: z.string().url().optional(),
  // ── Logos & icons ────────────────────────────
  logoUrl: z.string().url().optional(),
  logoDarkUrl: z.string().url().optional(),
  faviconUrl: z.string().url().optional(),
  ogImageUrl: z.string().url().optional(),
  // ── Colors ───────────────────────────────────
  primaryColor: hexColor.optional(),
  accentColor: hexColor.optional(),
  /** Page background used behind the main content area. */
  backgroundColor: hexColor.optional(),
  /** Sidebar background — separate from page background so tenants
   *  can hit the classic dark-nav-with-light-content pattern. */
  sidebarBgColor: hexColor.optional(),
  /** Destructive/danger accent used on delete-style buttons. */
  destructiveColor: hexColor.optional(),
  // ── Typography ───────────────────────────────
  fontFamily: z.enum(FONT_FAMILY_VALUES).optional(),
  // ── Interface ────────────────────────────────
  borderRadius: z.enum(BORDER_RADIUS_VALUES).optional(),
  buttonStyle: z.enum(BUTTON_STYLE_VALUES).optional(),
  /** When true, new visitors land on dark mode by default (they can
   *  still toggle). When false, light mode is the default. */
  darkModeDefault: z.boolean().optional(),
})

/** Fully-resolved branding — every field required. This is what
 *  consumers (BrandMark, root metadata, later PDFs/emails) receive. */
export const brandingSchema = brandingInputSchema.required({
  productName: true,
  logoUrl: true,
  primaryColor: true,
  accentColor: true,
  backgroundColor: true,
  sidebarBgColor: true,
  destructiveColor: true,
  supportEmail: true,
  fromName: true,
  legalCompany: true,
  fontFamily: true,
  borderRadius: true,
  buttonStyle: true,
  darkModeDefault: true,
})

export type BrandingInput = z.infer<typeof brandingInputSchema>
export type Branding = z.infer<typeof brandingSchema>

// Platform-level branding defaults — Kondense.
//
// Everything the resolver back-fills when a tenant's `companies.brand`
// JSON doesn't set a value. This is the single source of truth for the
// literals that used to live in `<BrandMark>`, `app/layout.tsx`
// metadata, email templates, `lib/discord.ts`, etc. Later phases
// migrate those callers off the literals and onto `getBranding()`.
//
// Colours match the existing `--brand-*` scale in `app/globals.css`.
// Bumping a value here shifts platform-default branding for every
// tenant that hasn't overridden it — treat as a co-ordinated change.

import type { Branding } from './schema'

export const DEFAULT_BRANDING: Branding = {
  productName: 'Kondense',
  logoUrl: '/kondense-logo.png',
  logoDarkUrl: '/kondense-logo.png',
  faviconUrl: '/favicon.ico',
  ogImageUrl: undefined,
  primaryColor: '#d11a1a',
  accentColor: undefined,
  supportEmail: 'support@kondense.ai',
  supportUrl: undefined,
  fromName: 'Kondense',
  legalCompany: 'Kondense',
  tagline: 'Agency Education Platform',
  privacyUrl: undefined,
  termsUrl: undefined,
}

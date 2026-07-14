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
  // Identity
  productName: 'Kondense',
  tagline: 'Agency Education Platform',
  supportEmail: 'support@kondense.ai',
  supportUrl: undefined,
  fromName: 'Kondense',
  legalCompany: 'Kondense',
  privacyUrl: undefined,
  termsUrl: undefined,
  // Logos & icons
  logoUrl: '/kondense-logo.png',
  logoDarkUrl: '/kondense-logo.png',
  faviconUrl: '/favicon.ico',
  ogImageUrl: undefined,
  // Colors
  primaryColor: '#d11a1a',
  accentColor: '#f97316',
  backgroundColor: '#0a0a0b',
  sidebarBgColor: '#0a0a0a',
  destructiveColor: '#ef4444',
  // Typography
  fontFamily: 'inter',
  // Interface
  borderRadius: 'default',
  buttonStyle: 'default',
  darkModeDefault: true,
}

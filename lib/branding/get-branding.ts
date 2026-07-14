// Server-side branding resolver.
//
// Every consumer that used to hardcode "Kondense" — <BrandMark>, root
// metadata, later emails / PDFs / OG images — should call
// `getBranding()` instead. It returns a fully-populated `Branding`
// object with tenant overrides layered over the platform defaults.
//
// Resolution order:
//   1. Header (`x-tenant-slug` set by the root middleware) — dev-only
//      stub today; Phase 3 replaces it with host-based resolution.
//   2. Cookie (`active_company_id` via getActiveCompany()) — the
//      switcher's persistent choice.
//   3. Kondense defaults from `DEFAULT_BRANDING`.
//
// Cached per request via React `cache()` so a layout + child pages
// share one lookup. Malformed brand JSON is logged and treated as an
// empty override — the app never renders half-broken branding.

import { cache } from 'react'

import { getActiveCompany } from '@/lib/tenancy/active-company'
import { getTenantFromHeaders } from '@/lib/tenancy/tenant-header'
import { DEFAULT_BRANDING } from './defaults'
import { brandingInputSchema, type Branding } from './schema'

export const getBranding = cache(async (): Promise<Branding> => {
  const tenant =
    (await safeGetTenantFromHeaders()) ?? (await safeGetActiveCompany())

  if (!tenant || !tenant.brand) return DEFAULT_BRANDING

  const parsed = brandingInputSchema.safeParse(tenant.brand)
  if (!parsed.success) {
    // Never hard-fail on a bad brand blob — a tenant that saved a
    // malformed value would otherwise take down every page they own.
    console.warn(
      `[branding] ignoring invalid brand JSON on company ${tenant.id}:`,
      parsed.error.flatten(),
    )
    return DEFAULT_BRANDING
  }

  return { ...DEFAULT_BRANDING, ...parsed.data }
})

/** Read-only projection of `Branding` fit for client components
 *  (BrandMark's optional props). Keep this small so we ship only
 *  what's actually rendered on the client. */
export function toClientBranding(b: Branding) {
  return {
    productName: b.productName,
    logoUrl: b.logoUrl,
    primaryColor: b.primaryColor,
  }
}
export type ClientBranding = ReturnType<typeof toClientBranding>

// ────────────────────────────────────────────
// INTERNALS
// ────────────────────────────────────────────

// Both wrappers swallow real resolver errors (branding is decorative
// — blowing up a page for a bad brand blob is worse than showing the
// platform default). They deliberately re-throw Next.js's dynamic-
// server-usage errors, which are a control-flow signal used by the
// static-generation pass to mark a route dynamic. Catching those
// causes a hundred harmless-but-alarming stack traces per build.

function isDynamicUsageError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { digest?: string }).digest === 'DYNAMIC_SERVER_USAGE'
  )
}

async function safeGetTenantFromHeaders() {
  try {
    return await getTenantFromHeaders()
  } catch (err) {
    if (isDynamicUsageError(err)) throw err
    console.warn('[branding] getTenantFromHeaders failed:', err)
    return null
  }
}

async function safeGetActiveCompany() {
  try {
    return await getActiveCompany()
  } catch (err) {
    if (isDynamicUsageError(err)) throw err
    console.warn('[branding] getActiveCompany failed:', err)
    return null
  }
}

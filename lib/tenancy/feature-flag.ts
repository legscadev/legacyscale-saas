// Multi-tenancy feature flag.
//
// Gates every code path introduced by the tenancy refactor
// (Company / CompanyMembership schema, active-company cookie, super-
// admin surface, per-tenant branding, custom-domain routing). While
// this reads false the app renders exactly as it did pre-refactor,
// which lets us merge phases into develop safely and cut over in
// Phase 7 by flipping a single env var.
//
// Source of truth for the flag is the server env; edge middleware
// reads the same value via process.env at request time. Callers
// should route every branch through `isTenancyEnabled()` — direct
// process.env reads bypass the guard rails we'll add later
// (per-request overrides, kill switch, etc.).

const TRUE_VALUES = new Set(['1', 'true', 'TRUE', 'yes', 'on'])

/**
 * Is the multi-tenancy layer active for this deploy?
 *
 * Default: false. Flip to true by setting `TENANCY_ENABLED=1` in the
 * environment. Prod stays false until Phase 7 rollout.
 */
export function isTenancyEnabled(): boolean {
  return TRUE_VALUES.has(process.env.TENANCY_ENABLED ?? '')
}

/**
 * Throw when a caller reaches a code path that requires tenancy but
 * the flag is off. Used at the entry to super-admin routes, company
 * switcher endpoints, etc. — anywhere a silent no-op would confuse
 * the caller more than a hard error.
 */
export function assertTenancyEnabled(): void {
  if (!isTenancyEnabled()) {
    throw new Error(
      'Multi-tenancy is disabled on this deploy. Set TENANCY_ENABLED=1.',
    )
  }
}

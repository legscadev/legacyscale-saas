// Storage path prefix for the active tenant. Every Supabase Storage
// bucket that carries per-tenant data (course-thumbnails,
// course-certificates, lesson-resources) puts objects under
// `<companyId>/…` so a future Storage RLS policy can filter by
// path prefix and cross-tenant enumeration is impossible via
// signed URLs.
//
// When the tenancy flag is off (or no request context), returns
// an empty string — every path stays exactly where it lives today.
//
// Callers spread with `withTenantPrefix('courses/xyz/thumbnail.png')`
// which yields either `<companyId>/courses/xyz/thumbnail.png` or the
// unprefixed original.

import { getRequestCompanyId } from './request-company'

/**
 * Prepend the active-tenant prefix to a bucket-relative path.
 * No-op when the tenancy flag is off.
 */
export async function withTenantPrefix(path: string): Promise<string> {
  const companyId = await getRequestCompanyId()
  if (!companyId) return path
  // Guard against accidental double-prefixing on retry paths.
  if (path.startsWith(`${companyId}/`)) return path
  return `${companyId}/${path}`
}

/**
 * Strip the tenant prefix off a signed-URL round-trip path so the
 * server-side validators (which know only about the bucket-relative
 * portion) still work. Symmetric with withTenantPrefix — no-op when
 * the tenancy flag is off or the string doesn't carry a prefix.
 */
export async function stripTenantPrefix(path: string): Promise<string> {
  const companyId = await getRequestCompanyId()
  if (!companyId) return path
  const prefix = `${companyId}/`
  return path.startsWith(prefix) ? path.slice(prefix.length) : path
}

import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Page routes accessible without authentication.
const PUBLIC_PREFIXES = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/onboarding', // admin-invited members landing here to set their password
  '/auth', // OAuth / email callback + error pages
  '/account-paused',
  '/unauthorized',
  '/maintenance',
  '/prototype', // static UI mockups (no auth)
  '/manifest.webmanifest', // per-tenant PWA manifest — no secrets
]

// ────────────────────────────────────────────
// Tenant resolution
// ────────────────────────────────────────────
//
// When TENANCY_ENABLED=1, forward the tenant slug as an
// `x-tenant-slug` request header so downstream Server Components can
// resolve the active tenant without touching the cookie.
//
// Three sources checked, first hit wins:
//   1. `?tenant=<slug>` query param (dev shortcut; Phase 1 stub).
//   2. Host header — if the host is `<slug>.<PLATFORM_APEX_DOMAIN>`,
//      extract the slug. Covers Phase-3 managed subdomains without
//      needing a DB lookup on the Edge.
//   3. Custom-domain host — resolved via an internal API route (added
//      in Phase-3 task 13; skipped in this task).

const TENANCY_QUERY_PARAM = 'tenant'
const TENANT_SLUG_HEADER = 'x-tenant-slug'
const TRUE_VALUES = new Set(['1', 'true', 'TRUE', 'yes', 'on'])
// Kebab slug: 1–60 chars, alnum + dashes, no leading/trailing dash.
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/

function tenancyEnabled(): boolean {
  return TRUE_VALUES.has(process.env.TENANCY_ENABLED ?? '')
}

/** Same defaults as `lib/domains/platform.ts` — inlined here so the
 *  Edge bundle stays free of the platform module and its exports. */
function getApex(): string {
  return process.env.PLATFORM_APEX_DOMAIN ?? 'localhost'
}
function getPlatformHost(): string {
  return process.env.PLATFORM_HOST ?? 'localhost:3000'
}

/** Extract the tenant slug from `<slug>.<apex>` — return null on
 *  anything else. Ignores port suffixes so localhost:3000 works. */
function slugFromHost(host: string): string | null {
  if (!host) return null
  const bare = host.split(':')[0]?.toLowerCase() ?? ''
  const apex = getApex().split(':')[0]?.toLowerCase() ?? ''
  const platformBare = getPlatformHost().split(':')[0]?.toLowerCase() ?? ''
  // Requests to the platform's own host don't count as tenant traffic.
  if (bare === platformBare) return null
  if (!apex || !bare.endsWith(`.${apex}`)) return null
  const slug = bare.slice(0, -apex.length - 1)
  return SLUG_PATTERN.test(slug) ? slug : null
}

/** True when host matches PLATFORM_HOST (case- and port-insensitive). */
function isPlatformHost(host: string): boolean {
  const bare = host.split(':')[0]?.toLowerCase() ?? ''
  const platformBare = getPlatformHost().split(':')[0]?.toLowerCase() ?? ''
  return bare === platformBare
}

// In-memory cache for custom-domain lookups. Vercel Edge keeps
// module state alive between invocations within a single instance,
// so this survives across many requests. Cold instances re-fetch on
// first hit — worst case 1 subrequest per unique host per instance
// per TTL window. Cache is keyed on the exact Host header (lowercased).
type CustomCacheEntry = { slug: string | null; expiresAt: number }
const customDomainCache = new Map<string, CustomCacheEntry>()
const CUSTOM_CACHE_TTL_MS = 5 * 60 * 1000

async function slugFromCustomDomain(
  request: NextRequest,
  host: string,
): Promise<string | null> {
  const key = host.toLowerCase()
  const hit = customDomainCache.get(key)
  const now = Date.now()
  if (hit && hit.expiresAt > now) return hit.slug

  try {
    const url = new URL('/api/tenancy/resolve-host', request.nextUrl)
    url.searchParams.set('host', key)
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      customDomainCache.set(key, {
        slug: null,
        expiresAt: now + CUSTOM_CACHE_TTL_MS,
      })
      return null
    }
    const body = (await res.json()) as { slug?: string | null }
    const slug = body.slug ?? null
    customDomainCache.set(key, {
      slug,
      expiresAt: now + CUSTOM_CACHE_TTL_MS,
    })
    return slug
  } catch (err) {
    console.warn('[proxy] resolve-host lookup failed:', err)
    return null
  }
}

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true // landing page
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

// Next.js 16 "proxy" convention (formerly "middleware"). Runs on the Edge
// runtime, so it handles auth/session + redirects only — no Prisma here.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always refresh the Supabase session cookies.
  const { user, supabaseResponse } = await updateSession(request)

  // Resolve tenant slug (query param OR host) and forward as
  // `x-tenant-slug`. Downstream Server Components pick it up via
  // `lib/tenancy/tenant-header.ts:getTenantFromHeaders()`.
  //
  // The internal resolve-host route we call for the custom-domain
  // branch is under /api, so this section is skipped when the
  // incoming request is itself heading to that route — avoiding a
  // recursion loop.
  if (tenancyEnabled() && !pathname.startsWith('/api/tenancy/resolve-host')) {
    const querySlug = request.nextUrl.searchParams.get(TENANCY_QUERY_PARAM)
    const host = request.headers.get('host') ?? ''
    const hostSlug = slugFromHost(host)
    let resolved =
      querySlug && SLUG_PATTERN.test(querySlug) ? querySlug : hostSlug
    if (!resolved && host && !isPlatformHost(host)) {
      resolved = await slugFromCustomDomain(request, host)
    }
    if (resolved) {
      supabaseResponse.headers.set(TENANT_SLUG_HEADER, resolved)
      request.headers.set(TENANT_SLUG_HEADER, resolved)
    }
  }

  // API routes enforce their own auth and must return JSON, not redirect.
  if (pathname.startsWith('/api')) {
    return supabaseResponse
  }

  // Public pages: allow. Bounce signed-in users away from auth screens.
  if (isPublicPath(pathname)) {
    if (user && (pathname === '/login' || pathname === '/signup')) {
      const role = user.app_metadata?.role
      const target = role === 'ADMIN' ? '/admin/dashboard' : '/dashboard'
      return NextResponse.redirect(new URL(target, request.url))
    }
    return supabaseResponse
  }

  // Protected pages: require an authenticated session.
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // RBAC is enforced at the (admin) route-group layout via requireAdmin().
  // The mirrored app_metadata.role above is a UX hint for redirects only,
  // not a security boundary — Prisma is the source of truth.
  return supabaseResponse
}

export const config = {
  matcher: [
    // Run on everything except Next internals and static assets.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}

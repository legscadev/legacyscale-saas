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
// Tenant resolution (Phase 1 white-label — dev-only stub)
// ────────────────────────────────────────────
//
// When TENANCY_ENABLED=1, forward `?tenant=<slug>` as the request
// header `x-tenant-slug`. Server components read it via
// `lib/tenancy/tenant-header.ts:getTenantFromHeaders()`. Phase 3
// replaces this with host-based resolution using the `Domain` table.

const TENANCY_QUERY_PARAM = 'tenant'
const TENANT_SLUG_HEADER = 'x-tenant-slug'
const TRUE_VALUES = new Set(['1', 'true', 'TRUE', 'yes', 'on'])
// Kebab slug: 1–60 chars, alnum + dashes, no leading/trailing dash.
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/

function tenancyEnabled(): boolean {
  return TRUE_VALUES.has(process.env.TENANCY_ENABLED ?? '')
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

  // If the caller passed a valid `?tenant=<slug>`, forward it as a
  // request header so downstream Server Components can resolve the
  // active tenant without touching the cookie.
  if (tenancyEnabled()) {
    const slug = request.nextUrl.searchParams.get(TENANCY_QUERY_PARAM)
    if (slug && SLUG_PATTERN.test(slug)) {
      supabaseResponse.headers.set(TENANT_SLUG_HEADER, slug)
      // Also carry it on the forwarded request so RSC's `headers()`
      // sees it (some Next runtimes read from either).
      request.headers.set(TENANT_SLUG_HEADER, slug)
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

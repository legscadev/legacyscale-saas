import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Page routes accessible without authentication.
const PUBLIC_PREFIXES = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/auth', // OAuth / email callback + error pages
  '/access-revoked',
  '/unauthorized',
  '/maintenance',
  '/prototype', // static UI mockups (no auth)
]

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

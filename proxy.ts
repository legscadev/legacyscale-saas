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
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return supabaseResponse
  }

  // Protected pages: require an authenticated session.
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // NOTE: Our admin role lives in the database, not the Supabase JWT, so it
  // can't be checked here (Prisma is unavailable on the Edge runtime).
  // Admin RBAC is enforced in the (admin) route-group layout via
  // requireAdmin() once admin routes land in 0.11.
  return supabaseResponse
}

export const config = {
  matcher: [
    // Run on everything except Next internals and static assets.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}

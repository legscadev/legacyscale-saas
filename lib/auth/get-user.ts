import { cache } from 'react'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import type { User } from '@prisma/client'

/** How often we bump last_active_at for a signed-in user. Kept
 *  generous so we're not writing on every navigation. */
const ACTIVITY_DEBOUNCE_MS = 15 * 60 * 1000

/**
 * Returns the current application user, or null if unauthenticated.
 * Looks up by `authId` (the Supabase auth id) and excludes
 * soft-deleted accounts.
 *
 * Wrapped in React's `cache()` so multiple call sites within the
 * SAME server request (layout + page + actions + service methods)
 * share one Supabase `auth.getUser()` + one Prisma user lookup. Per
 * request only — the cache is empty again on the next navigation,
 * which is the right semantics for auth.
 */
export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    return null
  }

  const user = await prisma.user.findFirst({
    where: { authId: authUser.id, deletedAt: null },
  })
  if (user) pingActivity(user)
  return user
})

/**
 * Fire-and-forget bump of `last_active_at` for the current user.
 * Runs after the response is sent so the page's TTFB isn't paid
 * by an extra round-trip. Also inserts a `login_events` row when
 * the last one for this user is on a previous calendar day so the
 * 30-day activity sparkline stays honest.
 *
 * Debounced: the SQL predicate `last_active_at < now() - interval`
 * makes concurrent requests race-free — only the first update in a
 * 15-minute window touches a row.
 */
function pingActivity(user: User): void {
  const now = Date.now()
  const previous = user.lastActiveAt?.getTime() ?? 0
  if (now - previous < ACTIVITY_DEBOUNCE_MS) return
  after(async () => {
    try {
      const cutoff = new Date(now - ACTIVITY_DEBOUNCE_MS)
      const stamp = new Date(now)
      await prisma.user.updateMany({
        where: {
          id: user.id,
          OR: [
            { lastActiveAt: null },
            { lastActiveAt: { lt: cutoff } },
          ],
        },
        data: { lastActiveAt: stamp },
      })
      // Once-per-day login_events row for the sparkline. Cheap:
      // the exists check is a single indexed lookup.
      const startOfToday = new Date(stamp)
      startOfToday.setHours(0, 0, 0, 0)
      const alreadyToday = await prisma.loginEvent.findFirst({
        where: { userId: user.id, loginAt: { gte: startOfToday } },
        select: { id: true },
      })
      if (!alreadyToday) {
        await prisma.loginEvent.create({
          data: { userId: user.id, loginAt: stamp },
        })
      }
    } catch (err) {
      // Activity tracking is best-effort — never fail the request
      // over a stat-log write.
      console.error('pingActivity failed:', err)
    }
  })
}

/** Requires an authenticated user; redirects to /login otherwise. */
export async function requireUser(): Promise<User> {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  return user
}

/** Requires an active (non-paused) user; redirects to /account-paused. */
export async function requireActiveUser(): Promise<User> {
  const user = await requireUser()

  if (!user.isActive) {
    redirect('/account-paused')
  }

  return user
}

/** Requires an active admin; redirects non-admins to /dashboard. */
export async function requireAdmin(): Promise<User> {
  const user = await requireActiveUser()

  if (user.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  return user
}

/**
 * API-route variant of requireAdmin. Instead of redirecting (which
 * breaks JSON consumers), throws an Error with a string token that
 * `withErrorHandling` maps to the right HTTP response:
 *   - "unauthorized"        → 401
 *   - "forbidden: ..."      → 403
 *
 * Use inside `withErrorHandling(...)` wrappers in app/api routes.
 */
export async function requireAdminApi(): Promise<User> {
  const user = await getUser()
  if (!user) throw new Error('unauthorized')
  if (!user.isActive) throw new Error('forbidden: account paused')
  if (user.role !== 'ADMIN') throw new Error('forbidden: admin only')
  return user
}

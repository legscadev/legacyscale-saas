import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import type { User } from '@prisma/client'

/**
 * Returns the current application user, or null if unauthenticated.
 * Looks up by `authId` (the Supabase auth id) and excludes
 * soft-deleted accounts.
 */
export async function getUser(): Promise<User | null> {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    return null
  }

  return prisma.user.findFirst({
    where: { authId: authUser.id, deletedAt: null },
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

/** Requires an admin; redirects non-admins to /dashboard. */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser()

  if (user.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  return user
}

/** Requires an active (non-revoked) user; redirects to /access-revoked. */
export async function requireActiveUser(): Promise<User> {
  const user = await requireUser()

  if (!user.isActive) {
    redirect('/access-revoked')
  }

  return user
}

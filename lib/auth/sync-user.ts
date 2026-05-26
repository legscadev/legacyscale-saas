import { prisma } from '@/lib/prisma'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { User } from '@prisma/client'

/**
 * Syncs a Supabase Auth user into the application `users` table.
 *
 * Keyed by `email` (stable + unique) so pre-seeded accounts — e.g. the
 * admin — are LINKED to their auth identity instead of duplicated. The
 * Supabase auth id is stored in `authId`, which the RLS policies match
 * against via `auth.uid()`. Existing role/name are preserved on update.
 */
export async function syncUserToDatabase(
  authUser: SupabaseUser
): Promise<User> {
  if (!authUser.email) {
    throw new Error('Cannot sync user without an email')
  }

  const emailVerified = Boolean(authUser.email_confirmed_at)

  return prisma.user.upsert({
    where: { email: authUser.email },
    update: {
      authId: authUser.id,
      emailVerified,
      lastLoginAt: new Date(),
    },
    create: {
      authId: authUser.id,
      email: authUser.email,
      name: readStringMetadata(authUser, 'name') ?? authUser.email.split('@')[0],
      avatarUrl: readStringMetadata(authUser, 'avatar_url'),
      role: 'MEMBER',
      isActive: true,
      emailVerified,
      lastLoginAt: new Date(),
    },
  })
}

function readStringMetadata(
  authUser: SupabaseUser,
  key: string
): string | undefined {
  const value = authUser.user_metadata?.[key]
  return typeof value === 'string' ? value : undefined
}

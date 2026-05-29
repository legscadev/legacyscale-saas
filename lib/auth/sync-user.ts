import { prisma } from '@/lib/prisma'
import { sendWelcomeEmail } from '@/lib/resend'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { User } from '@prisma/client'

/**
 * Syncs a Supabase Auth user into the application `users` table.
 *
 * Keyed by `email` (stable + unique) so pre-seeded accounts — e.g. the
 * admin — are LINKED to their auth identity instead of duplicated. The
 * Supabase auth id is stored in `authId`, which the RLS policies match
 * against via `auth.uid()`. Existing role/name are preserved on update.
 *
 * Fires a welcome email on first-time creation of MEMBER accounts.
 */
export async function syncUserToDatabase(
  authUser: SupabaseUser
): Promise<User> {
  if (!authUser.email) {
    throw new Error('Cannot sync user without an email')
  }

  const emailVerified = Boolean(authUser.email_confirmed_at)

  // Detect first-time signup so we don't spam pre-seeded admins / repeat
  // logins. A pre-seeded row exists by email but has no authId yet; we
  // still skip the welcome there.
  const existing = await prisma.user.findUnique({
    where: { email: authUser.email },
  })
  const isNewUser = !existing

  const user = await prisma.user.upsert({
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

  if (isNewUser && user.role === 'MEMBER') {
    await tryDeliverWelcome(user)
  }

  return user
}

function readStringMetadata(
  authUser: SupabaseUser,
  key: string
): string | undefined {
  const value = authUser.user_metadata?.[key]
  return typeof value === 'string' ? value : undefined
}

async function tryDeliverWelcome(user: User): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const loginUrl = `${appUrl}/dashboard`
  const displayName = user.name ?? user.email.split('@')[0]

  try {
    await sendWelcomeEmail(user.email, displayName, loginUrl)
  } catch (err) {
    // Never fail signup over an email problem — just log and move on.
    console.error('Welcome email send failed:', err)
  }
}

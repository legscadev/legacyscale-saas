// Manage the User.isSuperAdmin flag from a UI surface instead of
// hand-rolled SQL. Users are a global table (not tenant-scoped), so
// there's no runAsSuperAdmin dance needed here — the Prisma tenancy
// extension only intercepts scoped models.

import type { User } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { syncUserToDatabase } from '@/lib/auth/sync-user'
import { createAdminClient } from '@/lib/supabase/admin'

export interface SuperAdminRow {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  createdAt: Date
  lastActiveAt: Date | null
  /** True when this row IS the caller. The UI uses this to disable
   *  the "Revoke" button on your own row so you can't accidentally
   *  lock yourself out — the last-super-admin guard below already
   *  covers the "no super-admins left" edge case, this is just UX. */
  isSelf: boolean
}

export class LastSuperAdminError extends Error {
  constructor() {
    super('Cannot revoke the last super-admin')
    this.name = 'LastSuperAdminError'
  }
}

export class SelfRevokeError extends Error {
  constructor() {
    super('Cannot revoke your own super-admin flag')
    this.name = 'SelfRevokeError'
  }
}

export class UserNotFoundError extends Error {
  constructor(message = 'User not found') {
    super(message)
    this.name = 'UserNotFoundError'
  }
}

/** Every user currently carrying the master key. Sorted by name so
 *  the display stays stable across page loads. `isSelf` is set
 *  relative to `callerId`. */
export async function listSuperAdmins(
  callerId: string,
): Promise<SuperAdminRow[]> {
  const rows = await prisma.user.findMany({
    where: { isSuperAdmin: true, deletedAt: null },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      createdAt: true,
      lastActiveAt: true,
    },
  })
  return rows.map((u) => ({ ...u, isSelf: u.id === callerId }))
}

/**
 * Grant super-admin to a user by email. If the email is already
 * registered we flip the flag; otherwise we mint a fresh Supabase
 * auth user + local users row (via the same syncUserToDatabase path
 * member provisioning uses) and flip the flag on the fresh row.
 *
 * Callers upstream must verify the requester is themselves a
 * super-admin before invoking this — the service does not gate.
 */
export async function grantSuperAdmin(input: {
  email: string
  name?: string
}): Promise<{ user: User; wasNewlyCreated: boolean }> {
  const email = input.email.trim().toLowerCase()
  if (!email) throw new Error('Email is required')

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    if (existing.isSuperAdmin) {
      // Idempotent — treat a re-grant as a successful no-op so a
      // double-click doesn't error out.
      return { user: existing, wasNewlyCreated: false }
    }
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: { isSuperAdmin: true },
    })
    return { user: updated, wasNewlyCreated: false }
  }

  // Fresh account — mint via Supabase auth, then flip the flag.
  const admin = createAdminClient()
  const displayName = input.name?.trim() || email
  const { data: created, error: createErr } =
    await admin.auth.admin.createUser({
      email,
      password: randomPassword(),
      email_confirm: true,
      user_metadata: { name: displayName },
    })
  if (createErr || !created.user) {
    throw new Error(
      `Failed to create Supabase auth user: ${createErr?.message ?? 'unknown'}`,
    )
  }
  const synced = await syncUserToDatabase(created.user, {
    suppressWelcomeEmail: true,
  })
  const updated = await prisma.user.update({
    where: { id: synced.id },
    data: { isSuperAdmin: true },
  })
  return { user: updated, wasNewlyCreated: true }
}

/**
 * Revoke the flag on a user. Two guards:
 *   1. The caller can't revoke themselves — the UI already disables
 *      the button, but repeating server-side prevents a race where
 *      someone bookmarks the URL.
 *   2. You can't drop below one super-admin platform-wide. If this
 *      IS the last one, we throw LastSuperAdminError so the caller
 *      can render a clear message.
 */
export async function revokeSuperAdmin(input: {
  userId: string
  callerId: string
}): Promise<User> {
  if (input.userId === input.callerId) throw new SelfRevokeError()

  const target = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, isSuperAdmin: true },
  })
  if (!target) throw new UserNotFoundError()
  if (!target.isSuperAdmin) {
    // Idempotent — already non-super-admin, nothing to do.
    const passthrough = await prisma.user.findUniqueOrThrow({
      where: { id: input.userId },
    })
    return passthrough
  }

  const count = await prisma.user.count({
    where: { isSuperAdmin: true, deletedAt: null },
  })
  if (count <= 1) throw new LastSuperAdminError()

  return prisma.user.update({
    where: { id: input.userId },
    data: { isSuperAdmin: false },
  })
}

function randomPassword(): string {
  const buf = new Uint8Array(24)
  crypto.getRandomValues(buf)
  return Buffer.from(buf).toString('base64')
}

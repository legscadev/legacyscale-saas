// Manage super-admin grants — Phase 4.4 rewrite.
//
// The source of truth is the super_admin_grants table (one row per
// grant/revoke event over time; the active grant per user is the
// row where revoked_at IS NULL). The User.isSuperAdmin boolean is
// kept in sync as a hot-path cache so every gate check stays a
// column read instead of a JOIN; the column drops in Phase 7 once
// every reader has moved off it.
//
// Every grant + revoke runs inside a Prisma transaction so the
// table and the cached boolean never drift.

import type { SuperAdminRole, User } from '@prisma/client'

import { prisma } from '@/lib/prisma'

export interface SuperAdminRow {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  createdAt: Date
  lastActiveAt: Date | null
  /** Active grant metadata — from the super_admin_grants row where
   *  revoked_at IS NULL. */
  grant: {
    id: string
    role: SuperAdminRole
    grantedAt: Date
    expiresAt: Date | null
    notes: string | null
    grantedBy: { id: string; name: string | null; email: string } | null
  }
  /** True when this row IS the caller. UI uses this to disable
   *  the "Revoke" button on your own row so you can't accidentally
   *  lock yourself out — the last-super-admin guard covers the
   *  edge case, this is just UX. */
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

/** Thrown when the operator tries to grant super-admin to an
 *  email that isn't registered on the platform. We deliberately
 *  refuse to mint fresh accounts from this surface — the master
 *  key is too destructive to hand out based on a possibly-typo'd
 *  email. Operators must invite the person as a regular member
 *  first (which goes through the full welcome + password-reset
 *  flow) and then promote them here. */
export class UnknownEmailError extends Error {
  constructor(
    message = 'No user with this email. Invite them as a member first, then grant super-admin.',
  ) {
    super(message)
    this.name = 'UnknownEmailError'
  }
}

/** Every user with an active grant. Sorted by name so the UI
 *  order stays stable. `isSelf` is set relative to `callerId`.
 *  Excludes grants whose expires_at has already passed. */
export async function listSuperAdmins(
  callerId: string,
): Promise<SuperAdminRow[]> {
  const now = new Date()
  const grants = await prisma.superAdminGrant.findMany({
    where: {
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      user: { deletedAt: null },
    },
    orderBy: [
      { user: { name: 'asc' } },
      { user: { email: 'asc' } },
    ],
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          createdAt: true,
          lastActiveAt: true,
        },
      },
      grantedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  })

  return grants.map((g) => ({
    id: g.user.id,
    email: g.user.email,
    name: g.user.name,
    avatarUrl: g.user.avatarUrl,
    createdAt: g.user.createdAt,
    lastActiveAt: g.user.lastActiveAt,
    grant: {
      id: g.id,
      role: g.role,
      grantedAt: g.grantedAt,
      expiresAt: g.expiresAt,
      notes: g.notes,
      grantedBy: g.grantedBy
        ? {
            id: g.grantedBy.id,
            name: g.grantedBy.name,
            email: g.grantedBy.email,
          }
        : null,
    },
    isSelf: g.user.id === callerId,
  }))
}

export interface GrantInput {
  email: string
  role?: SuperAdminRole
  expiresAt?: Date | null
  notes?: string | null
  grantedById?: string | null
}

/**
 * Grant super-admin to an EXISTING user by email. Refuses unknown
 * emails on purpose — the master key is too destructive to hand
 * out based on a typo. Operators must invite the person as a
 * regular member first (which sends a welcome + password-reset
 * link) and then promote them here.
 *
 * Idempotent on re-grant (user already has an active grant →
 * returns the existing state without inserting a duplicate row).
 *
 * Callers upstream must verify the requester is themselves a
 * super-admin before invoking this — the service does not gate.
 */
export async function grantSuperAdmin(
  input: GrantInput,
): Promise<{ user: User }> {
  const email = input.email.trim().toLowerCase()
  if (!email) throw new Error('Email is required')
  const role: SuperAdminRole = input.role ?? 'MASTER'

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw new UnknownEmailError()

  const targetUserId = user.id

  await prisma.$transaction(async (tx) => {
    // Idempotency — if the user already has an active grant, just
    // no-op. Prevents duplicate rows on a double-click.
    const existing = await tx.superAdminGrant.findFirst({
      where: {
        userId: targetUserId,
        revokedAt: null,
      },
      select: { id: true },
    })
    if (!existing) {
      await tx.superAdminGrant.create({
        data: {
          userId: targetUserId,
          role,
          grantedById: input.grantedById ?? null,
          expiresAt: input.expiresAt ?? null,
          notes: input.notes ?? null,
        },
      })
    }
    // Sync the hot-path cache. Every reader today still gates on
    // this column, so this keeps the flip visible immediately.
    await tx.user.update({
      where: { id: targetUserId },
      data: { isSuperAdmin: true },
    })
  })

  const refreshed = await prisma.user.findUniqueOrThrow({
    where: { id: targetUserId },
  })
  return { user: refreshed }
}

/**
 * Revoke the active grant on a user. Two guards:
 *   1. The caller can't revoke themselves — the UI disables the
 *      button, but the server enforces it too so a bookmarked
 *      URL can't lock them out.
 *   2. You can't drop below one active MASTER super-admin
 *      platform-wide. If this IS the last one, LastSuperAdminError
 *      is thrown so the caller can render a clear message.
 *
 * "Revoke" is a soft-delete on the grant row — we set revoked_at
 * + revoked_by_id so the audit trail keeps the row. Never DELETE.
 */
export async function revokeSuperAdmin(input: {
  userId: string
  callerId: string
}): Promise<User> {
  if (input.userId === input.callerId) throw new SelfRevokeError()

  const target = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true },
  })
  if (!target) throw new UserNotFoundError()

  await prisma.$transaction(async (tx) => {
    const activeGrant = await tx.superAdminGrant.findFirst({
      where: { userId: input.userId, revokedAt: null },
      select: { id: true, role: true },
    })
    // Idempotent — no active grant means already revoked; keep
    // the cached boolean in sync just in case it drifted and
    // return.
    if (!activeGrant) {
      await tx.user.update({
        where: { id: input.userId },
        data: { isSuperAdmin: false },
      })
      return
    }

    // Guard: refuse to drop below one active MASTER platform-wide.
    // MASTER is the only role that opens /super today; the SUPPORT
    // + AUDITOR seats can't grant new super-admins, so leaving the
    // platform with only those roles would be a lockout.
    const activeMasterCount = await tx.superAdminGrant.count({
      where: {
        revokedAt: null,
        role: 'MASTER',
        user: { deletedAt: null },
      },
    })
    if (activeGrant.role === 'MASTER' && activeMasterCount <= 1) {
      throw new LastSuperAdminError()
    }

    await tx.superAdminGrant.update({
      where: { id: activeGrant.id },
      data: {
        revokedAt: new Date(),
        revokedById: input.callerId,
      },
    })
    await tx.user.update({
      where: { id: input.userId },
      data: { isSuperAdmin: false },
    })
  })

  return prisma.user.findUniqueOrThrow({
    where: { id: input.userId },
  })
}

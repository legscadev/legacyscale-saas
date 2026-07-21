// Per-user Internal-module access grants for TEAM staff.
//
// Business rules:
//   - ADMIN role always has access to every module (this service
//     never gets consulted for admin users — the auth helper
//     short-circuits before it hits us).
//   - TEAM role: access = has an unrevoked grant for the module
//     in the current tenant. Zero grants = zero access.
//   - MEMBER role: never has access. Auth helper redirects before
//     we're called.
//
// The write path is append-only: grant/revoke both write a row.
// A grant re-issued after revocation creates a fresh row; the old
// (revokedAt-set) row stays in the timeline. Enforcement of the
// "one unrevoked row per (user, module)" invariant lives here in
// the service, not the DB — a unique index would need to be
// partial (`WHERE revoked_at IS NULL`) and Prisma can't declare
// those directly.

import type { User } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import {
  ALL_TEAM_MODULE_KEYS,
  isKnownTeamModuleKey,
  type TeamModuleKey,
} from '@/lib/config/team-modules'
import { getRequestCompanyId } from '@/lib/tenancy/request-company'

export class UnknownModuleError extends Error {
  constructor(key: string) {
    super(`Unknown team module key: "${key}"`)
    this.name = 'UnknownModuleError'
  }
}

export class TeamAccessTargetError extends Error {
  constructor(message = 'Can only grant/revoke access to TEAM users') {
    super(message)
    this.name = 'TeamAccessTargetError'
  }
}

export interface ActiveGrant {
  id: string
  moduleKey: TeamModuleKey
  grantedAt: Date
  grantedBy: { id: string; name: string | null; email: string } | null
}

async function requireCompanyId(): Promise<string> {
  const id = await getRequestCompanyId()
  if (!id) throw new Error('team-access-service: no active company')
  return id
}

class TeamAccessService {
  /**
   * All unrevoked grants for a user in the current tenant. Empty
   * array = no access. Used by the shell to build the sidebar and
   * by the grid dialog to pre-check the right boxes.
   */
  async listActiveGrants(userId: string): Promise<ActiveGrant[]> {
    const rows = await prisma.teamModuleGrant.findMany({
      where: { userId, revokedAt: null },
      include: {
        grantedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { grantedAt: 'desc' },
    })
    // Filter out unknown keys just in case an older grant references
    // a module that's since been removed from the catalog. Keeps the
    // client-side render surface tight.
    return rows
      .filter((r) => isKnownTeamModuleKey(r.moduleKey))
      .map((r) => ({
        id: r.id,
        moduleKey: r.moduleKey as TeamModuleKey,
        grantedAt: r.grantedAt,
        grantedBy: r.grantedBy,
      }))
  }

  /** Convenience: just the set of granted keys. Hot-path for the
   *  auth check + sidebar filter. */
  async grantedKeys(userId: string): Promise<Set<TeamModuleKey>> {
    const grants = await this.listActiveGrants(userId)
    return new Set(grants.map((g) => g.moduleKey))
  }

  /**
   * True when the user is allowed to reach `moduleKey`. ADMIN
   * always passes, MEMBER never, TEAM checks grants.
   *
   * Callers pass the already-loaded User so we don't re-query
   * (auth pages have it in hand).
   */
  async hasModuleAccess(
    user: Pick<User, 'id' | 'role'>,
    moduleKey: TeamModuleKey,
  ): Promise<boolean> {
    if (user.role === 'ADMIN') return true
    if (user.role !== 'TEAM') return false
    const count = await prisma.teamModuleGrant.count({
      where: { userId: user.id, moduleKey, revokedAt: null },
    })
    return count > 0
  }

  /**
   * Grant `moduleKey` to a TEAM user. No-op if the user already
   * has an unrevoked grant for that key (idempotent). Rejects
   * ADMIN targets (they don't need grants) and MEMBER targets
   * (they can't hold them).
   */
  async grant(args: {
    targetUserId: string
    moduleKey: string
    grantedById: string | null
  }): Promise<ActiveGrant> {
    if (!isKnownTeamModuleKey(args.moduleKey)) {
      throw new UnknownModuleError(args.moduleKey)
    }
    const companyId = await requireCompanyId()

    const target = await prisma.user.findFirst({
      where: { id: args.targetUserId, deletedAt: null },
      select: { id: true, role: true },
    })
    if (!target || target.role !== 'TEAM') {
      throw new TeamAccessTargetError()
    }

    // Return the existing unrevoked row if one is already open —
    // the client can call grant() from an optimistic toggle
    // without needing to know the current state.
    const existing = await prisma.teamModuleGrant.findFirst({
      where: {
        userId: args.targetUserId,
        moduleKey: args.moduleKey,
        revokedAt: null,
      },
      include: {
        grantedBy: { select: { id: true, name: true, email: true } },
      },
    })
    if (existing) {
      return {
        id: existing.id,
        moduleKey: existing.moduleKey as TeamModuleKey,
        grantedAt: existing.grantedAt,
        grantedBy: existing.grantedBy,
      }
    }

    const row = await prisma.teamModuleGrant.create({
      data: {
        userId: args.targetUserId,
        moduleKey: args.moduleKey,
        grantedById: args.grantedById,
        companyId,
      },
      include: {
        grantedBy: { select: { id: true, name: true, email: true } },
      },
    })
    return {
      id: row.id,
      moduleKey: row.moduleKey as TeamModuleKey,
      grantedAt: row.grantedAt,
      grantedBy: row.grantedBy,
    }
  }

  /**
   * Revoke `moduleKey` for a TEAM user. Idempotent: no-op if the
   * user has no unrevoked grant. Uses updateMany so we can flip
   * every open row at once (shouldn't happen — the invariant is
   * one — but defensive against past bugs).
   */
  async revoke(args: {
    targetUserId: string
    moduleKey: string
    revokedById: string | null
  }): Promise<void> {
    if (!isKnownTeamModuleKey(args.moduleKey)) {
      throw new UnknownModuleError(args.moduleKey)
    }
    await prisma.teamModuleGrant.updateMany({
      where: {
        userId: args.targetUserId,
        moduleKey: args.moduleKey,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedById: args.revokedById,
      },
    })
  }

  /** All module keys. Used by the backfill migration and the
   *  "grant all" default-set flow. */
  readonly allKeys = ALL_TEAM_MODULE_KEYS
}

export const teamAccessService = new TeamAccessService()

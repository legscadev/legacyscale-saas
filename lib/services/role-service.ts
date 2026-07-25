// Custom-role service.
//
// Business rules:
//   - ADMIN tier always has access to every module (this service
//     never gets consulted for admin users — the auth helper
//     short-circuits before it hits us).
//   - TEAM tier: access to a module = at least one of the user's
//     roles carries a permission with that moduleKey.
//   - MEMBER tier: never has access. Auth helper redirects before
//     we're called.
//
// Roles are created + edited from /admin/roles. `isSystem` rows
// (seeded 'internal-team' + per-user 'legacy' shims from the
// TeamModuleGrant migration) cannot be deleted; name/description
// are still editable.

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

export class RoleTargetError extends Error {
  constructor(message = 'Can only assign roles to TEAM users') {
    super(message)
    this.name = 'RoleTargetError'
  }
}

export interface RoleSummary {
  id: string
  name: string
  slug: string
  description: string | null
  isSystem: boolean
  moduleKeys: TeamModuleKey[]
  memberCount: number
  createdAt: Date
  updatedAt: Date
}

export interface AssignedRole {
  id: string
  roleId: string
  name: string
  slug: string
  assignedAt: Date
  assignedBy: { id: string; name: string | null; email: string } | null
}

async function requireCompanyId(): Promise<string> {
  const id = await getRequestCompanyId()
  if (!id) throw new Error('role-service: no active company')
  return id
}

class RoleService {
  /** Every custom role in the current company, with permission
   *  keys + assigned-user counts. Powers the /admin/roles list. */
  async listRoles(): Promise<RoleSummary[]> {
    const rows = await prisma.role.findMany({
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: {
        permissions: { select: { moduleKey: true } },
        _count: { select: { assignments: true } },
      },
    })
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      isSystem: r.isSystem,
      moduleKeys: r.permissions
        .map((p) => p.moduleKey)
        .filter(isKnownTeamModuleKey),
      memberCount: r._count.assignments,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
  }

  /** Everyone's roles for a given user, in the current company.
   *  Used by the member editor to show current assignments. */
  async listAssignmentsForUser(userId: string): Promise<AssignedRole[]> {
    const rows = await prisma.userRoleAssignment.findMany({
      where: { userId },
      orderBy: { assignedAt: 'desc' },
      include: {
        role: { select: { id: true, name: true, slug: true } },
        assignedBy: { select: { id: true, name: true, email: true } },
      },
    })
    return rows.map((r) => ({
      id: r.id,
      roleId: r.roleId,
      name: r.role.name,
      slug: r.role.slug,
      assignedAt: r.assignedAt,
      assignedBy: r.assignedBy,
    }))
  }

  /** Set of module keys the user has access to via any of their
   *  roles. Hot-path for the auth gate + sidebar filter. */
  async grantedKeys(userId: string): Promise<Set<TeamModuleKey>> {
    const rows = await prisma.rolePermission.findMany({
      where: {
        role: {
          assignments: { some: { userId } },
        },
      },
      select: { moduleKey: true },
    })
    const out = new Set<TeamModuleKey>()
    for (const r of rows) {
      if (isKnownTeamModuleKey(r.moduleKey)) out.add(r.moduleKey)
    }
    return out
  }

  /**
   * True when the user is allowed to reach `moduleKey`. ADMIN
   * always passes, MEMBER never, TEAM checks assigned roles'
   * permissions.
   */
  async hasModuleAccess(
    user: Pick<User, 'id' | 'role'>,
    moduleKey: TeamModuleKey,
  ): Promise<boolean> {
    if (user.role === 'ADMIN') return true
    if (user.role !== 'TEAM') return false
    const count = await prisma.rolePermission.count({
      where: {
        moduleKey,
        role: { assignments: { some: { userId: user.id } } },
      },
    })
    return count > 0
  }

  /**
   * Create a new custom role in the active company. Slug is
   * derived from the name if not provided. Permissions can be
   * seeded at creation.
   */
  async createRole(args: {
    name: string
    slug?: string
    description?: string | null
    moduleKeys: TeamModuleKey[]
  }): Promise<RoleSummary> {
    const companyId = await requireCompanyId()
    const slug = args.slug ?? slugify(args.name)

    const role = await prisma.role.create({
      data: {
        companyId,
        name: args.name.trim(),
        slug,
        description: args.description?.trim() || null,
        permissions: {
          createMany: {
            data: args.moduleKeys.filter(isKnownTeamModuleKey).map((k) => ({
              moduleKey: k,
              companyId,
            })),
          },
        },
      },
      include: {
        permissions: { select: { moduleKey: true } },
        _count: { select: { assignments: true } },
      },
    })
    return {
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      isSystem: role.isSystem,
      moduleKeys: role.permissions
        .map((p) => p.moduleKey)
        .filter(isKnownTeamModuleKey),
      memberCount: role._count.assignments,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }
  }

  /**
   * Update a role's name/description and completely replace its
   * permission set with the given keys. Deletes removed
   * permissions, adds new ones — simplest to reason about from a
   * checkbox-matrix UI.
   */
  async updateRole(
    id: string,
    args: {
      name?: string
      description?: string | null
      moduleKeys?: TeamModuleKey[]
    },
  ): Promise<RoleSummary> {
    const companyId = await requireCompanyId()

    await prisma.role.update({
      where: { id },
      data: {
        ...(args.name !== undefined ? { name: args.name.trim() } : {}),
        ...(args.description !== undefined
          ? { description: args.description?.trim() || null }
          : {}),
      },
    })

    if (args.moduleKeys) {
      const valid = args.moduleKeys.filter(isKnownTeamModuleKey)
      await prisma.$transaction([
        prisma.rolePermission.deleteMany({ where: { roleId: id } }),
        prisma.rolePermission.createMany({
          data: valid.map((k) => ({
            roleId: id,
            moduleKey: k,
            companyId,
          })),
        }),
      ])
    }

    const role = await prisma.role.findFirst({
      where: { id },
      include: {
        permissions: { select: { moduleKey: true } },
        _count: { select: { assignments: true } },
      },
    })
    if (!role) throw new Error('Role not found after update')
    return {
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      isSystem: role.isSystem,
      moduleKeys: role.permissions
        .map((p) => p.moduleKey)
        .filter(isKnownTeamModuleKey),
      memberCount: role._count.assignments,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }
  }

  /** Delete a custom role. System roles are refused with a clear
   *  error — those exist to preserve migrated grants and must not
   *  disappear. */
  async deleteRole(id: string): Promise<void> {
    const role = await prisma.role.findFirst({
      where: { id },
      select: { isSystem: true },
    })
    if (!role) return
    if (role.isSystem) {
      throw new Error('System roles cannot be deleted (rename them instead).')
    }
    await prisma.role.delete({ where: { id } })
  }

  /**
   * Replace a user's role set with the given role ids. Anything
   * not in `roleIds` is unassigned. ADMIN + TEAM tiers can hold
   * role assignments (ADMIN tags are informational — the tier
   * bypasses the permission check anyway); MEMBER tier is
   * refused because students don't hold custom roles today.
   */
  async setUserRoles(args: {
    targetUserId: string
    roleIds: string[]
    assignedById: string | null
  }): Promise<void> {
    const companyId = await requireCompanyId()

    const target = await prisma.user.findFirst({
      where: { id: args.targetUserId, deletedAt: null },
      select: { id: true, role: true },
    })
    if (!target || target.role === 'MEMBER') {
      throw new RoleTargetError()
    }

    // Sanity-check role ids belong to the active company.
    const roles = await prisma.role.findMany({
      where: { id: { in: args.roleIds } },
      select: { id: true },
    })
    const validIds = new Set(roles.map((r) => r.id))

    await prisma.$transaction([
      prisma.userRoleAssignment.deleteMany({
        where: { userId: args.targetUserId },
      }),
      prisma.userRoleAssignment.createMany({
        data: [...validIds].map((roleId) => ({
          userId: args.targetUserId,
          roleId,
          companyId,
          assignedById: args.assignedById,
        })),
      }),
    ])
  }

  /** All module keys. Used by the create-role form's checkbox
   *  matrix + the "grant everything" default-set flow. */
  readonly allKeys = ALL_TEAM_MODULE_KEYS
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export const roleService = new RoleService()

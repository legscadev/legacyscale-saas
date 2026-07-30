// Shared helper for the "who can I assign this to?" pickers across
// the CRM (opportunity Assigned to, lead Assign to, bulk-assign,
// filter drawers). Every surface needs the same rule so the same
// list of names shows up everywhere.
//
// Rule (matches GHL naming conventions):
// - Prefer users whose role name/slug contains "setter" OR "closer"
//   (case-insensitive) — those are the sales team.
// - Fall back to every active ADMIN/TEAM user when the tenant hasn't
//   set up those roles yet, so a fresh install doesn't get an empty
//   picker that reads as broken.

import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

export interface CrmAssignableUser {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
}

export async function listAssignableSalesUsers(
  tenantScope: Prisma.UserWhereInput | undefined,
): Promise<CrmAssignableUser[]> {
  const baseWhere: Prisma.UserWhereInput = {
    deletedAt: null,
    isActive: true,
    role: { in: ['ADMIN', 'TEAM'] },
    ...(tenantScope ?? {}),
  }
  const setterMatch = { contains: 'setter', mode: 'insensitive' as const }
  const closerMatch = { contains: 'closer', mode: 'insensitive' as const }
  const salesRoleFilter: Prisma.UserWhereInput = {
    roleAssignments: {
      some: {
        role: {
          OR: [
            { name: setterMatch },
            { slug: setterMatch },
            { name: closerMatch },
            { slug: closerMatch },
          ],
        },
      },
    },
  }

  const scoped = await prisma.user.findMany({
    where: { ...baseWhere, ...salesRoleFilter },
    select: { id: true, name: true, email: true, avatarUrl: true },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
  })
  if (scoped.length > 0) return scoped

  return prisma.user.findMany({
    where: baseWhere,
    select: { id: true, name: true, email: true, avatarUrl: true },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
  })
}

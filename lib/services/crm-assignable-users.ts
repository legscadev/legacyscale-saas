// Shared helper for the "who can I assign this to?" pickers across
// the CRM (opportunity Assigned to, lead Assign to, bulk-assign,
// filter drawers). Every surface needs the same rule so the same
// list of names shows up everywhere.
//
// Rule (matches GHL naming conventions):
// - Every active ADMIN is included implicitly — admins take calls +
//   own deals too, and shouldn't need a Setter/Closer role assignment
//   to appear in the picker.
// - Plus any TEAM (or ADMIN) user whose role name/slug contains
//   "setter" OR "closer" (case-insensitive) — the sales team.
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
  options: { strict?: boolean } = {},
): Promise<CrmAssignableUser[]> {
  const baseWhere: Prisma.UserWhereInput = {
    deletedAt: null,
    isActive: true,
    role: { in: ['ADMIN', 'TEAM'] },
    ...(tenantScope ?? {}),
  }
  const setterMatch = { contains: 'setter', mode: 'insensitive' as const }
  const closerMatch = { contains: 'closer', mode: 'insensitive' as const }
  // Match sales-team members OR always-in ADMINs. Admins are
  // included regardless of whether they hold a Setter/Closer role
  // assignment — the ADMIN branch is the "you always show up in
  // this picker" escape hatch for owner-operators who take calls.
  const salesRoleFilter: Prisma.UserWhereInput = {
    OR: [
      { role: 'ADMIN' },
      {
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
      },
    ],
  }

  const scoped = await prisma.user.findMany({
    where: { ...baseWhere, ...salesRoleFilter },
    select: { id: true, name: true, email: true, avatarUrl: true },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
  })

  // Strict mode (import wizard) never falls back — an empty picker
  // is the correct nudge to configure Setter/Closer roles first.
  // The interactive pickers (opportunities Assigned to, leads
  // Assign to submenu) fall back to all ADMIN/TEAM to avoid an
  // empty dropdown on fresh tenants that haven't set up roles yet.
  if (options.strict || scoped.length > 0) return scoped

  return prisma.user.findMany({
    where: baseWhere,
    select: { id: true, name: true, email: true, avatarUrl: true },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
  })
}

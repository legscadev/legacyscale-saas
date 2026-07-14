import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { setActiveCompanyCookie } from '@/lib/tenancy/active-company'
import { isTenancyEnabled } from '@/lib/tenancy/feature-flag'

const bodySchema = z.object({
  companyId: z.string().min(1),
})

/**
 * Switch the caller's active company. Verifies the target company
 * exists and — for non-super-admins — that the caller has a
 * membership on it. Sets the active-company cookie on success.
 *
 * Returns 404 when tenancy is disabled so callers can't probe the
 * endpoint's shape ahead of Phase 7 rollout.
 */
export async function POST(request: NextRequest) {
  if (!isTenancyEnabled()) {
    return new NextResponse('Not found', { status: 404 })
  }
  const user = await requireActiveUser()
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const company = await prisma.company.findFirst({
    where: { id: parsed.data.companyId, deletedAt: null },
    select: { id: true },
  })
  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  if (!user.isSuperAdmin) {
    const membership = await prisma.companyMembership.findUnique({
      where: {
        userId_companyId: { userId: user.id, companyId: company.id },
      },
      select: { id: true },
    })
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  await setActiveCompanyCookie(company.id)
  return NextResponse.json({ ok: true })
}

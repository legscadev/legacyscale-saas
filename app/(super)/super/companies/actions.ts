'use server'

import { redirect } from 'next/navigation'

import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { setActiveCompanyCookie } from '@/lib/tenancy/active-company'
import { isTenancyEnabled } from '@/lib/tenancy/feature-flag'

/**
 * Sets the caller's active-company cookie to the given tenant and
 * redirects into the admin console. Super-admin only — everyone
 * else gets bounced to /dashboard, matching the layout gate.
 *
 * The redirect target is /admin/dashboard so the super-admin lands
 * exactly where a regular tenant admin would after signing in.
 */
export async function enterCompanyAction(formData: FormData) {
  if (!isTenancyEnabled()) redirect('/dashboard')

  const user = await requireActiveUser()
  if (!user.isSuperAdmin) redirect('/dashboard')

  const companyId = String(formData.get('companyId') ?? '')
  if (!companyId) redirect('/super/companies')

  const company = await prisma.company.findFirst({
    where: { id: companyId, deletedAt: null },
    select: { id: true },
  })
  if (!company) redirect('/super/companies')

  await setActiveCompanyCookie(company.id)
  redirect('/admin/dashboard')
}

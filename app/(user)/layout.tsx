import { cookies } from 'next/headers'

import { AppShell } from '@/components/layout'
import { SIDEBAR_COOKIE } from '@/components/layout/sidebar-cookie'
import { NudgeBanner } from '@/components/member/nudge-banner'
import { requireActiveUser } from '@/lib/auth'
import { getBranding, toClientBranding } from '@/lib/branding/get-branding'
import { announcementService } from '@/lib/services/announcement-service'
import { listActiveNudgesForUser } from '@/lib/services/nudge-service'
import {
  getActiveCompany,
  listCompaniesForUser,
} from '@/lib/tenancy/active-company'
import { isTenancyEnabled } from '@/lib/tenancy/feature-flag'

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Enforces auth + active (non-revoked) account; redirects otherwise.
  const user = await requireActiveUser()
  const cookieStore = await cookies()
  const defaultCollapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === '1'
  // Best-effort — surface the announcement Bell badge if we can.
  // A failure here shouldn't blank the whole shell.
  let unreadAnnouncements = 0
  try {
    unreadAnnouncements = await announcementService.getUnreadCount(user.id)
  } catch (err) {
    console.error('getUnreadCount (member layout) failed:', err)
  }

  // Admin-authored re-engagement banners. Best-effort — never block
  // the shell if the query fails.
  let nudges: Awaited<ReturnType<typeof listActiveNudgesForUser>> = []
  try {
    nudges = await listActiveNudgesForUser(user.id)
  } catch (err) {
    console.error('listActiveNudgesForUser failed:', err)
  }

  // Tenancy props — undefined when the flag is off.
  let tenancy:
    | {
        activeCompanyId: string | null
        companies: { id: string; name: string; isAgency: boolean }[]
        currentUserIsSuperAdmin: boolean
      }
    | undefined
  if (isTenancyEnabled()) {
    const [active, companies] = await Promise.all([
      getActiveCompany(),
      listCompaniesForUser(user),
    ])
    tenancy = {
      activeCompanyId: active?.id ?? null,
      companies: companies.map((c) => ({
        id: c.id,
        name: c.name,
        isAgency: c.isAgency,
      })),
      currentUserIsSuperAdmin: user.isSuperAdmin,
    }
  }

  // Kondense defaults when tenancy is off; per-tenant overrides
  // when it's on. See lib/branding/get-branding.ts.
  const branding = toClientBranding(await getBranding())

  return (
    <AppShell
      role="member"
      defaultCollapsed={defaultCollapsed}
      unreadAnnouncements={unreadAnnouncements}
      user={{
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
      }}
      tenancy={tenancy}
      branding={branding}
    >
      <div className="mx-auto w-full max-w-7xl space-y-4">
        {nudges.length > 0 ? <NudgeBanner nudges={nudges} /> : null}
        {children}
      </div>
    </AppShell>
  )
}

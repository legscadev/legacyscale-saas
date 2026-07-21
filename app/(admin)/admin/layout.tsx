import { cookies } from 'next/headers'

import { AppShell } from '@/components/layout'
import { SIDEBAR_COOKIE } from '@/components/layout/sidebar-cookie'
import { requireTeamOrAdmin } from '@/lib/auth'
import { getBranding, toClientBranding } from '@/lib/branding/get-branding'
import { announcementService } from '@/lib/services/announcement-service'
import { teamAccessService } from '@/lib/services/team-access-service'
import {
  getActiveCompany,
  listCompaniesForUser,
} from '@/lib/tenancy/active-company'
import { isTenancyEnabled } from '@/lib/tenancy/feature-flag'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Enforces auth + (ADMIN | TEAM). Per-page requireAdmin +
  // requireTeamModuleAccess("key") narrow further where needed.
  // TEAM staff can reach the Internal admin routes their grants
  // cover (Task Tracker, Statistics, etc.); everything else on
  // /admin/* still requires ADMIN via the per-page gate.
  const user = await requireTeamOrAdmin()
  const cookieStore = await cookies()
  const defaultCollapsed =
    cookieStore.get(SIDEBAR_COOKIE)?.value === '1'
  // Best-effort — surface the announcement Bell badge if we can.
  // A failure here shouldn't blank the whole shell.
  let unreadAnnouncements = 0
  try {
    unreadAnnouncements = await announcementService.getUnreadCount(user.id)
  } catch (err) {
    console.error('getUnreadCount (admin layout) failed:', err)
  }

  // Tenancy props — undefined when the flag is off so the sidebar
  // renders exactly as it did pre-refactor.
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

  // Branding — always resolvable. When tenancy is off (or no
  // company override) this returns the Kondense platform defaults,
  // so the sidebar looks identical to pre-refactor.
  const branding = toClientBranding(await getBranding())
  // Signal to the shell whether the active tenant has a saved brand
  // — used to disable the light/dark toggle (see ThemeToggle) when
  // inline theme vars in the root layout would make it a no-op.
  const activeForTheme = await getActiveCompany()
  const themeLocked = Boolean(activeForTheme?.brand)

  // Per-user Internal-module grants — only meaningful for TEAM.
  // AppShell uses these to filter the sidebar (and command palette).
  // ADMIN sees everything regardless of what's in this array.
  let grantedModules: string[] = []
  if (user.role === 'TEAM') {
    try {
      const grants = await teamAccessService.listActiveGrants(user.id)
      grantedModules = grants.map((g) => g.moduleKey)
    } catch (err) {
      console.error('listActiveGrants (admin layout) failed:', err)
    }
  }

  return (
    <AppShell
      role="admin"
      defaultCollapsed={defaultCollapsed}
      unreadAnnouncements={unreadAnnouncements}
      user={{
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
      }}
      tenancy={tenancy}
      isSuperAdmin={user.isSuperAdmin}
      branding={branding}
      themeLocked={themeLocked}
      grantedModules={grantedModules}
    >
      {children}
    </AppShell>
  )
}

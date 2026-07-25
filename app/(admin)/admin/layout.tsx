import { cookies } from 'next/headers'

import { AppShell } from '@/components/layout'
import { SIDEBAR_COOKIE } from '@/components/layout/sidebar-cookie'
import { requireTeamOrAdmin } from '@/lib/auth'
import { getBranding, toClientBranding } from '@/lib/branding/get-branding'
import { announcementService } from '@/lib/services/announcement-service'
import { roleService } from '@/lib/services/role-service'
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
  // Layout allows both ADMIN and TEAM tiers in — per-route gates
  // (requireTeamModuleAccess) decide which specific admin pages a
  // TEAM user can reach based on their assigned custom roles.
  // MEMBER tier still gets bounced to /dashboard.
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

  // Effective module permissions from the viewer's role assignments.
  // Only meaningful for TEAM tier — ADMIN bypasses the sidebar filter
  // and sees every item. Empty set on failure so a query hiccup
  // doesn't blank the whole shell.
  let grantedModules: string[] = []
  if (user.role === 'TEAM') {
    try {
      const keys = await roleService.grantedKeys(user.id)
      grantedModules = [...keys]
    } catch (err) {
      console.error('roleService.grantedKeys (admin layout) failed:', err)
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
      grantedModules={user.role === 'ADMIN' ? undefined : grantedModules}
    >
      {children}
    </AppShell>
  )
}

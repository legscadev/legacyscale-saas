import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

import { AppShell } from '@/components/layout'
import { SIDEBAR_COOKIE } from '@/components/layout/sidebar-cookie'
import { requireActiveUser } from '@/lib/auth'
import { DEFAULT_BRANDING } from '@/lib/branding/defaults'
import { toClientBranding } from '@/lib/branding/get-branding'
import { isTenancyEnabled } from '@/lib/tenancy/feature-flag'

/**
 * Super-admin console. Only visible when:
 *   - Multi-tenancy is enabled on this deploy, AND
 *   - The signed-in user carries User.isSuperAdmin = true.
 *
 * Everyone else gets notFound() so the surface's existence isn't
 * leaked to non-super-admins (better than a 403 that broadcasts
 * "there's something here but you can't have it").
 */
export default async function SuperLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Hide the surface entirely when the feature is off — protects
  // against enabling the flag by accident in dev.
  if (!isTenancyEnabled()) notFound()

  const user = await requireActiveUser()
  if (!user.isSuperAdmin) {
    // Non-super-admins in an authenticated session go home; the
    // surface stays undiscoverable to unauthenticated callers via
    // the notFound() branch above once auth is required.
    redirect('/dashboard')
  }

  const cookieStore = await cookies()
  const defaultCollapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === '1'

  return (
    <AppShell
      role="super"
      defaultCollapsed={defaultCollapsed}
      user={{
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
      }}
      // Super console is the platform surface — always show platform
      // (Kondense) branding, even when the caller has an active
      // per-tenant cookie set. Skips a DB lookup.
      branding={toClientBranding(DEFAULT_BRANDING)}
    >
      {children}
    </AppShell>
  )
}

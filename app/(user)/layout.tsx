import { cookies } from 'next/headers'

import { AppShell } from '@/components/layout'
import { SIDEBAR_COOKIE } from '@/components/layout/sidebar-cookie'
import { requireActiveUser } from '@/lib/auth'

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Enforces auth + active (non-revoked) account; redirects otherwise.
  const user = await requireActiveUser()
  const cookieStore = await cookies()
  const defaultCollapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === '1'

  return (
    <AppShell
      role="member"
      defaultCollapsed={defaultCollapsed}
      user={{
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
      }}
    >
      <div className="mx-auto w-full max-w-7xl">{children}</div>
    </AppShell>
  )
}

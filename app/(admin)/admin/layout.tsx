import { cookies } from 'next/headers'

import { AppShell } from '@/components/layout'
import { SIDEBAR_COOKIE } from '@/components/layout/sidebar-cookie'
import { requireAdmin } from '@/lib/auth'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Enforces auth + ADMIN role; redirects otherwise.
  const user = await requireAdmin()
  const cookieStore = await cookies()
  const defaultCollapsed =
    cookieStore.get(SIDEBAR_COOKIE)?.value === '1'

  return (
    <AppShell
      role="admin"
      defaultCollapsed={defaultCollapsed}
      user={{
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
      }}
    >
      {children}
    </AppShell>
  )
}

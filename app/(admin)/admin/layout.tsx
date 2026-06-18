import { cookies } from 'next/headers'

import { AppShell } from '@/components/layout'
import { SIDEBAR_COOKIE } from '@/components/layout/sidebar-cookie'
import { requireAdmin } from '@/lib/auth'
import { announcementService } from '@/lib/services/announcement-service'

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
  // Best-effort — surface the announcement Bell badge if we can.
  // A failure here shouldn't blank the whole shell.
  let unreadAnnouncements = 0
  try {
    unreadAnnouncements = await announcementService.getUnreadCount(user.id)
  } catch (err) {
    console.error('getUnreadCount (admin layout) failed:', err)
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
    >
      {children}
    </AppShell>
  )
}

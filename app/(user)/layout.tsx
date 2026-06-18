import { cookies } from 'next/headers'

import { AppShell } from '@/components/layout'
import { SIDEBAR_COOKIE } from '@/components/layout/sidebar-cookie'
import { requireActiveUser } from '@/lib/auth'
import { announcementService } from '@/lib/services/announcement-service'

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
    >
      <div className="mx-auto w-full max-w-7xl">{children}</div>
    </AppShell>
  )
}

import { AppShell } from '@/components/layout'
import { requireActiveUser } from '@/lib/auth'

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Enforces auth + active (non-revoked) account; redirects otherwise.
  const user = await requireActiveUser()

  return (
    <AppShell
      role="member"
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

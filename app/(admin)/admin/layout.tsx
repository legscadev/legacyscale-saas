import { AppShell } from '@/components/layout'
import { requireAdmin } from '@/lib/auth'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Enforces auth + ADMIN role; redirects otherwise.
  const user = await requireAdmin()

  return (
    <AppShell
      role="admin"
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

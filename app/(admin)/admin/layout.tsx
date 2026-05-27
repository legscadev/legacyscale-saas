import { TopNav } from '@/components/layout'
import { requireAdmin } from '@/lib/auth'
import { adminNavItems } from '@/lib/config/navigation'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Enforces auth + ADMIN role; redirects otherwise.
  const user = await requireAdmin()

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav navItems={adminNavItems} user={user} />
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}

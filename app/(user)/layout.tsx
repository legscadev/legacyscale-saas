import { TopNav } from '@/components/layout'
import { requireActiveUser } from '@/lib/auth'
import { userNavItems } from '@/lib/config/navigation'

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Enforces auth + active (non-revoked) account; redirects otherwise.
  const user = await requireActiveUser()

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav navItems={userNavItems} user={user} />
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}

import { requireTeamOrAdmin } from '@/lib/auth'

/**
 * Layout-level gate for the TEAM read view of policies. The parent
 * (user) layout only requires an active user (any role), so this
 * secondary check keeps LMS members out even though they share the
 * shell. ADMIN users can read here too but should reach the write
 * surface at /admin/policies instead.
 */
export default async function PoliciesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireTeamOrAdmin()
  return <>{children}</>
}

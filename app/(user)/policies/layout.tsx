import { requireTeamModuleAccess } from '@/lib/auth'

/**
 * Layout-level gate for the TEAM read view of policies. Requires
 * the 'policies' module grant for TEAM users (ADMIN passes
 * unconditionally). MEMBER never reaches here because the outer
 * requireTeamOrAdmin composed inside requireTeamModuleAccess
 * bounces them first.
 *
 * ADMIN visiting /policies is also handled — they'll get through
 * the gate but the /policies page itself redirects them to
 * /admin/policies (their proper editor surface).
 */
export default async function PoliciesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireTeamModuleAccess('policies')
  return <>{children}</>
}

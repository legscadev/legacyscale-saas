import { redirect } from 'next/navigation'

import { requireAdmin } from '@/lib/auth/get-user'

// /admin is an alias for the admin dashboard. Also serves as an
// ADMIN gate now that the parent layout accepts TEAM — a TEAM
// user hitting /admin gets bounced to /dashboard instead of
// silently landing on /admin/dashboard.
export default async function AdminIndexPage() {
  await requireAdmin()
  redirect('/admin/dashboard')
}

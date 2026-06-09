import { redirect } from 'next/navigation'

// /admin is an alias for the admin dashboard.
export default function AdminIndexPage() {
  redirect('/admin/dashboard')
}

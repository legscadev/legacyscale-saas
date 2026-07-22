import { redirect } from 'next/navigation'

// Backwards-compat: the Categories module was renamed to Membership.
// Legacy links / bookmarks land here and forward to the new home.
export default function CategoriesRedirect() {
  redirect('/admin/membership')
}

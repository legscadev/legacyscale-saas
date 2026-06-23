import { requireAdmin } from '@/lib/auth/get-user'
import { CategoriesShell } from '@/components/admin/categories/categories-shell'
import { fetchCategories } from './actions'

export default async function AdminCategoriesPage() {
  await requireAdmin()
  const initialData = await fetchCategories()

  return <CategoriesShell initialData={initialData} />
}

'use server'

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/auth/get-user'
import {
  categoryService,
  type CategoryListItem,
} from '@/lib/services/category-service'
import {
  createCategorySchema,
  updateCategorySchema,
} from '@/lib/validations/category'

export interface CategoriesData {
  items: CategoryListItem[]
}

export async function fetchCategories(): Promise<CategoriesData> {
  await requireAdmin()
  const items = await categoryService.list()
  return { items }
}

export interface CategoryMutationResult {
  ok: boolean
  id?: string
  error?: string
  fieldErrors?: Record<string, string[]>
}

function fieldErrorsFromZod(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>) {
  const out: Record<string, string[]> = {}
  for (const issue of issues) {
    const key = issue.path.map(String).join('.')
    if (!out[key]) out[key] = []
    out[key]!.push(issue.message)
  }
  return out
}

export async function createCategoryAction(
  formData: FormData,
): Promise<CategoryMutationResult> {
  await requireAdmin()

  const parsed = createCategorySchema.safeParse({
    name: (formData.get('name') as string) ?? '',
    slug: (formData.get('slug') as string) || undefined,
    description: (formData.get('description') as string) || undefined,
  })

  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  try {
    const row = await categoryService.create(parsed.data)
    revalidatePath('/admin/categories')
    return { ok: true, id: row.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not create category'
    return { ok: false, error: message }
  }
}

export async function updateCategoryAction(
  id: string,
  formData: FormData,
): Promise<CategoryMutationResult> {
  await requireAdmin()

  const input: Record<string, unknown> = {}
  if (formData.has('name')) input.name = formData.get('name')
  if (formData.has('slug')) input.slug = formData.get('slug') || ''
  if (formData.has('description')) {
    const raw = formData.get('description') as string
    input.description = raw.length > 0 ? raw : null
  }

  const parsed = updateCategorySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  try {
    await categoryService.update(id, parsed.data)
    revalidatePath('/admin/categories')
    revalidatePath('/admin/courses')
    return { ok: true, id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not update category'
    return { ok: false, error: message }
  }
}

export async function deleteCategoryAction(
  id: string,
): Promise<CategoryMutationResult> {
  await requireAdmin()
  try {
    await categoryService.delete(id)
    revalidatePath('/admin/categories')
    revalidatePath('/admin/courses')
    return { ok: true }
  } catch (err) {
    console.error('Category delete failed:', err)
    return { ok: false, error: 'Could not delete category' }
  }
}

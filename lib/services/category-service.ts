import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { ensureUniqueSlug, slugify } from '@/lib/utils/slug'
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from '@/lib/validations/category'

export type CategorySortField = 'name' | 'createdAt'
export type SortDirection = 'asc' | 'desc'

interface ListCategoriesOptions {
  search?: string
  sort?: CategorySortField
  direction?: SortDirection
}

const categorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { courses: true } },
} satisfies Prisma.CategorySelect

type CategoryRow = Prisma.CategoryGetPayload<{ select: typeof categorySelect }>

function shape(row: CategoryRow) {
  const { _count, ...rest } = row
  return { ...rest, courseCount: _count.courses }
}

async function listCategories(options: ListCategoriesOptions = {}) {
  const { search, sort = 'name', direction = 'asc' } = options

  const where: Prisma.CategoryWhereInput | undefined = search?.trim()
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
        ],
      }
    : undefined

  const orderBy: Prisma.CategoryOrderByWithRelationInput =
    sort === 'createdAt' ? { createdAt: direction } : { name: direction }

  const rows = await prisma.category.findMany({
    where,
    orderBy,
    select: categorySelect,
  })
  return rows.map(shape)
}

async function getCategoryById(id: string) {
  const row = await prisma.category.findUnique({
    where: { id },
    select: categorySelect,
  })
  return row ? shape(row) : null
}

async function isSlugTakenByOther(slug: string, excludeId?: string) {
  const hit = await prisma.category.findUnique({
    where: { slug },
    select: { id: true },
  })
  return hit !== null && hit.id !== excludeId
}

async function createCategory(input: CreateCategoryInput) {
  const baseSlug = input.slug && input.slug.length > 0 ? input.slug : input.name
  const slug = await ensureUniqueSlug(slugify(baseSlug), (candidate) =>
    isSlugTakenByOther(candidate),
  )

  // Name uniqueness is enforced by the DB; surface the failure as a
  // friendly error instead of a Prisma exception.
  const existingName = await prisma.category.findUnique({
    where: { name: input.name },
    select: { id: true },
  })
  if (existingName) {
    throw new Error('A category with this name already exists')
  }

  const row = await prisma.category.create({
    data: {
      name: input.name,
      slug,
      description: input.description ?? null,
    },
    select: categorySelect,
  })
  return shape(row)
}

async function updateCategory(id: string, input: UpdateCategoryInput) {
  const data: Prisma.CategoryUpdateInput = {}

  if (input.name !== undefined) data.name = input.name
  if (input.description !== undefined) data.description = input.description

  if (input.slug !== undefined) {
    const baseSlug =
      input.slug.length > 0 ? input.slug : (input.name ?? '')
    const desired = slugify(baseSlug)
    if (desired.length === 0) {
      throw new Error('Slug cannot be empty')
    }
    if (await isSlugTakenByOther(desired, id)) {
      throw new Error('That slug is already in use')
    }
    data.slug = desired
  }

  if (input.name !== undefined) {
    const existingName = await prisma.category.findUnique({
      where: { name: input.name },
      select: { id: true },
    })
    if (existingName && existingName.id !== id) {
      throw new Error('A category with this name already exists')
    }
  }

  const row = await prisma.category.update({
    where: { id },
    data,
    select: categorySelect,
  })
  return shape(row)
}

async function deleteCategory(id: string) {
  // Junction rows cascade via the Prisma relation onDelete.
  await prisma.category.delete({ where: { id } })
}

export const categoryService = {
  list: listCategories,
  getById: getCategoryById,
  create: createCategory,
  update: updateCategory,
  delete: deleteCategory,
}

export type CategoryListItem = Awaited<
  ReturnType<typeof listCategories>
>[number]
export type CategoryDetail = NonNullable<
  Awaited<ReturnType<typeof getCategoryById>>
>

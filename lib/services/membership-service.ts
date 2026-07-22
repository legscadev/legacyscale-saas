import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { ensureUniqueSlug, slugify } from '@/lib/utils/slug'
import type {
  CreateMembershipInput,
  UpdateMembershipInput,
} from '@/lib/validations/membership'

export type MembershipSortField = 'name' | 'createdAt'
export type SortDirection = 'asc' | 'desc'

interface ListMembershipsOptions {
  search?: string
  sort?: MembershipSortField
  direction?: SortDirection
}

const membershipSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { courses: true } },
} satisfies Prisma.MembershipSelect

type MembershipRow = Prisma.MembershipGetPayload<{ select: typeof membershipSelect }>

function shape(row: MembershipRow) {
  const { _count, ...rest } = row
  return { ...rest, courseCount: _count.courses }
}

async function listMemberships(options: ListMembershipsOptions = {}) {
  const { search, sort = 'name', direction = 'asc' } = options

  const where: Prisma.MembershipWhereInput | undefined = search?.trim()
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
        ],
      }
    : undefined

  const orderBy: Prisma.MembershipOrderByWithRelationInput =
    sort === 'createdAt' ? { createdAt: direction } : { name: direction }

  const rows = await prisma.membership.findMany({
    where,
    orderBy,
    select: membershipSelect,
  })
  return rows.map(shape)
}

async function getMembershipById(id: string) {
  const row = await prisma.membership.findUnique({
    where: { id },
    select: membershipSelect,
  })
  return row ? shape(row) : null
}

async function isSlugTakenByOther(slug: string, excludeId?: string) {
  const hit = await prisma.membership.findUnique({
    where: { slug },
    select: { id: true },
  })
  return hit !== null && hit.id !== excludeId
}

async function createMembership(input: CreateMembershipInput) {
  const baseSlug = input.slug && input.slug.length > 0 ? input.slug : input.name
  const slug = await ensureUniqueSlug(slugify(baseSlug), (candidate) =>
    isSlugTakenByOther(candidate),
  )

  // Name uniqueness is enforced by the DB; surface the failure as a
  // friendly error instead of a Prisma exception.
  const existingName = await prisma.membership.findUnique({
    where: { name: input.name },
    select: { id: true },
  })
  if (existingName) {
    throw new Error('A membership with this name already exists')
  }

  const row = await prisma.membership.create({
    data: {
      name: input.name,
      slug,
      description: input.description ?? null,
    },
    select: membershipSelect,
  })
  return shape(row)
}

async function updateMembership(id: string, input: UpdateMembershipInput) {
  const data: Prisma.MembershipUpdateInput = {}

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
    const existingName = await prisma.membership.findUnique({
      where: { name: input.name },
      select: { id: true },
    })
    if (existingName && existingName.id !== id) {
      throw new Error('A membership with this name already exists')
    }
  }

  const row = await prisma.membership.update({
    where: { id },
    data,
    select: membershipSelect,
  })
  return shape(row)
}

async function deleteMembership(id: string) {
  // Junction rows cascade via the Prisma relation onDelete.
  await prisma.membership.delete({ where: { id } })
}

export const membershipService = {
  list: listMemberships,
  getById: getMembershipById,
  create: createMembership,
  update: updateMembership,
  delete: deleteMembership,
}

export type MembershipListItem = Awaited<
  ReturnType<typeof listMemberships>
>[number]
export type MembershipDetail = NonNullable<
  Awaited<ReturnType<typeof getMembershipById>>
>

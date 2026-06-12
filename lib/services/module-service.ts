import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

// ============================================
// MODULE SERVICE
// ============================================
//
// Modules are an optional grouping layer between Course and Chapter.
// They share the same top-level orderIndex space on the course as
// loose chapters (chapters with moduleId = null), but are managed
// through a dedicated service so the course-structure sync can stay
// focused on chapters + lessons.
//
// Delete is HARD delete. Chapter.module is declared with
// `onDelete: SetNull`, so deleting a module turns its chapters into
// loose chapters on the same course (no lessons are destroyed and no
// Mux/Storage cleanup is needed at the module level).

const moduleListSelect = {
  id: true,
  courseId: true,
  title: true,
  description: true,
  orderIndex: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { chapters: { where: { deletedAt: null } } } },
} satisfies Prisma.ModuleSelect

async function listByCourse(courseId: string) {
  return prisma.module.findMany({
    where: { courseId, deletedAt: null },
    orderBy: { orderIndex: 'asc' },
    select: moduleListSelect,
  })
}

async function getById(id: string) {
  return prisma.module.findFirst({
    where: { id, deletedAt: null },
    select: moduleListSelect,
  })
}

interface CreateModuleInput {
  courseId: string
  title: string
  description?: string | null
}

async function createModule({
  courseId,
  title,
  description,
}: CreateModuleInput) {
  // Place new modules at the end of the course's existing module
  // ordering. Loose chapters share the same orderIndex space
  // conceptually, but here we only need to avoid colliding with other
  // modules — the admin UI reconciles the combined ordering when it
  // reorders top-level items.
  const last = await prisma.module.findFirst({
    where: { courseId, deletedAt: null },
    orderBy: { orderIndex: 'desc' },
    select: { orderIndex: true },
  })
  const orderIndex = (last?.orderIndex ?? -1) + 1

  return prisma.module.create({
    data: {
      courseId,
      title,
      description: description ?? null,
      orderIndex,
    },
    select: moduleListSelect,
  })
}

interface UpdateModuleInput {
  title?: string
  description?: string | null
  orderIndex?: number
}

async function updateModule(id: string, input: UpdateModuleInput) {
  const data: Prisma.ModuleUpdateInput = {}
  if (input.title !== undefined) data.title = input.title
  if (input.description !== undefined) data.description = input.description
  if (input.orderIndex !== undefined) data.orderIndex = input.orderIndex

  return prisma.module.update({
    where: { id },
    data,
    select: moduleListSelect,
  })
}

/**
 * Hard delete. Schema's `onDelete: SetNull` on Chapter.module turns
 * the module's chapters into loose chapters on the same course; no
 * lesson data is destroyed and no external-asset (Mux/Storage)
 * cleanup is required here.
 */
async function deleteModule(id: string) {
  return prisma.module.delete({ where: { id }, select: { id: true } })
}

/**
 * Bulk reorder within a course. Each id is rewritten to its position
 * in the array. Callers are responsible for the desired order.
 */
async function reorderModules(courseId: string, orderedIds: string[]) {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.module.update({
        where: { id, courseId },
        data: { orderIndex: index },
      }),
    ),
  )
}

export const moduleService = {
  list: listByCourse,
  getById,
  create: createModule,
  update: updateModule,
  delete: deleteModule,
  reorder: reorderModules,
}

export type ModuleListItem = Awaited<
  ReturnType<typeof listByCourse>
>[number]

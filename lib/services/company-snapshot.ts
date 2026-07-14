// Clone a company's content (categories + course catalog) into
// another company. Used by the /super sub-account creation flow so
// a new tenant can start from an agency's canonical template
// instead of a blank shell.
//
// What gets copied
//   - Categories (name + slug + description)
//   - Courses (metadata) with status forced to DRAFT
//   - Course → Category memberships (id-remapped)
//   - Modules
//   - Chapters (including moduleId → new moduleId via id-remap)
//   - Lessons (title, description, type, orderIndex only)
//
// What does NOT get copied
//   - Enrollments, progress, certificate issuances
//   - Mux assets + LessonResource files (they belong to the source
//     bucket path; a proper media clone is a bigger job that lives
//     outside this snapshot)
//   - Announcements, org board, stats, employees, notes — those are
//     per-tenant runtime content, not template content
//
// Slug conflicts
//   Course.slug and Category.slug are still globally unique in the
//   schema (a per-tenant unique migration is deferred). ensureUnique
//   walks slug → slug-2 → slug-3 … until it finds a free one, and
//   applies the same suffix to the name for readability. This keeps
//   the operation idempotent-ish — running snapshot twice just
//   creates numbered copies rather than erroring.

import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { runAsSuperAdmin } from '@/lib/tenancy/request-company'

export interface SnapshotSummary {
  categoriesCopied: number
  coursesCopied: number
  modulesCopied: number
  chaptersCopied: number
  lessonsCopied: number
}

export interface SnapshotOptions {
  sourceCompanyId: string
  targetCompanyId: string
  /** When false, categories aren't copied (courses still land in
   *  target but stripped of category memberships that would point
   *  at rows we didn't clone). Defaults to true. */
  includeCategories?: boolean
  /** When false, courses aren't copied. Rare — only useful for a
   *  "just categories" seed. Defaults to true. */
  includeCourses?: boolean
}

export async function snapshotCompany(
  options: SnapshotOptions,
): Promise<SnapshotSummary> {
  const {
    sourceCompanyId,
    targetCompanyId,
    includeCategories = true,
    includeCourses = true,
  } = options

  if (sourceCompanyId === targetCompanyId) {
    throw new Error('Refusing to snapshot a company into itself')
  }

  return runAsSuperAdmin(async () => {
    const [sourceCompany, targetCompany] = await Promise.all([
      prisma.company.findFirst({
        where: { id: sourceCompanyId, deletedAt: null },
        select: { id: true },
      }),
      prisma.company.findFirst({
        where: { id: targetCompanyId, deletedAt: null },
        select: { id: true },
      }),
    ])
    if (!sourceCompany) throw new Error('Source company not found')
    if (!targetCompany) throw new Error('Target company not found')

    // Load source content up-front so the transaction only writes.
    const [categories, courses] = await Promise.all([
      includeCategories
        ? prisma.category.findMany({
            where: { companyId: sourceCompanyId },
            orderBy: { createdAt: 'asc' },
          })
        : Promise.resolve([]),
      includeCourses
        ? prisma.course.findMany({
            where: { companyId: sourceCompanyId, deletedAt: null },
            orderBy: { orderIndex: 'asc' },
            include: {
              categories: { select: { categoryId: true } },
              modules: {
                where: { deletedAt: null },
                orderBy: { orderIndex: 'asc' },
              },
              chapters: {
                where: { deletedAt: null },
                orderBy: { orderIndex: 'asc' },
                include: {
                  lessons: {
                    where: { deletedAt: null },
                    orderBy: { orderIndex: 'asc' },
                  },
                },
              },
            },
          })
        : Promise.resolve([]),
    ])

    return prisma.$transaction(async (tx) => {
      const categoryIdMap = new Map<string, string>()
      const courseIdMap = new Map<string, string>()
      let modulesCopied = 0
      let chaptersCopied = 0
      let lessonsCopied = 0

      // 1. Categories (course-independent)
      for (const cat of categories) {
        const uniqueSlug = await ensureUniqueSlug('category', tx, cat.slug)
        const suffix = suffixFromSlug(cat.slug, uniqueSlug)
        const uniqueName = suffix ? `${cat.name} ${suffix}` : cat.name
        const created = await tx.category.create({
          data: {
            name: uniqueName,
            slug: uniqueSlug,
            description: cat.description,
            companyId: targetCompanyId,
          },
          select: { id: true },
        })
        categoryIdMap.set(cat.id, created.id)
      }

      // 2. Courses (+ per-course modules → chapters → lessons)
      for (const course of courses) {
        const uniqueSlug = await ensureUniqueSlug('course', tx, course.slug)
        const suffix = suffixFromSlug(course.slug, uniqueSlug)
        const uniqueTitle = suffix ? `${course.title} ${suffix}` : course.title
        const created = await tx.course.create({
          data: {
            title: uniqueTitle,
            slug: uniqueSlug,
            description: course.description,
            thumbnailUrl: course.thumbnailUrl,
            coverImageUrl: course.coverImageUrl,
            // Clones always start life as DRAFT so an admin can review
            // before publishing. The source's PUBLISHED status doesn't
            // travel.
            status: 'DRAFT',
            isFree: course.isFree,
            audience: course.audience,
            accessDays: course.accessDays,
            certificateEnabled: course.certificateEnabled,
            orderIndex: course.orderIndex,
            createdBy: course.createdBy,
            companyId: targetCompanyId,
          },
          select: { id: true },
        })
        courseIdMap.set(course.id, created.id)

        // Category memberships — only for categories we cloned.
        for (const link of course.categories) {
          const mappedCategoryId = categoryIdMap.get(link.categoryId)
          if (!mappedCategoryId) continue
          await tx.courseCategory.create({
            data: {
              courseId: created.id,
              categoryId: mappedCategoryId,
              companyId: targetCompanyId,
            },
          })
        }

        // Modules for this course. Chapters below reference them by
        // id, so the id-remap needs to be ready before the chapter
        // loop starts.
        const perCourseModuleMap = new Map<string, string>()
        for (const mod of course.modules) {
          const moduleCreated = await tx.module.create({
            data: {
              courseId: created.id,
              title: mod.title,
              description: mod.description,
              orderIndex: mod.orderIndex,
              companyId: targetCompanyId,
            },
            select: { id: true },
          })
          perCourseModuleMap.set(mod.id, moduleCreated.id)
          modulesCopied += 1
        }

        for (const chapter of course.chapters) {
          const mappedModuleId = chapter.moduleId
            ? (perCourseModuleMap.get(chapter.moduleId) ?? null)
            : null
          const chapterCreated = await tx.chapter.create({
            data: {
              courseId: created.id,
              moduleId: mappedModuleId,
              title: chapter.title,
              orderIndex: chapter.orderIndex,
              companyId: targetCompanyId,
            },
            select: { id: true },
          })
          chaptersCopied += 1

          if (chapter.lessons.length > 0) {
            await tx.lesson.createMany({
              data: chapter.lessons.map((lesson) => ({
                chapterId: chapterCreated.id,
                title: lesson.title,
                description: lesson.description,
                type: lesson.type,
                // Reset to DRAFT — no mux asset was carried over, so
                // even VIDEO lessons need to be re-uploaded.
                status: 'DRAFT' as const,
                orderIndex: lesson.orderIndex,
                companyId: targetCompanyId,
              })),
            })
            lessonsCopied += chapter.lessons.length
          }
        }
      }

      return {
        categoriesCopied: categoryIdMap.size,
        coursesCopied: courseIdMap.size,
        modulesCopied,
        chaptersCopied,
        lessonsCopied,
      }
    }, {
      maxWait: 10_000,
      timeout: 120_000,
    })
  })
}

// ═══════════════════════════════════════════════════════════════
// INTERNALS
// ═══════════════════════════════════════════════════════════════

/**
 * Find the next free slug in the shape `base`, `base-2`, `base-3`…
 * Runs a series of point-selects (each is a single-row PK-adjacent
 * hit on a unique index) rather than one greedy LIKE query, so it
 * plays nicely with the transaction isolation level. Terminates at
 * 500 attempts — beyond that something is very wrong.
 */
async function ensureUniqueSlug(
  kind: 'course' | 'category',
  tx: Prisma.TransactionClient,
  base: string,
): Promise<string> {
  for (let i = 1; i <= 500; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`
    const exists =
      kind === 'course'
        ? await tx.course.findFirst({
            where: { slug: candidate },
            select: { id: true },
          })
        : await tx.category.findFirst({
            where: { slug: candidate },
            select: { id: true },
          })
    if (!exists) return candidate
  }
  throw new Error(`Could not find a unique ${kind} slug after 500 tries`)
}

/**
 * Extract the numeric suffix ensureUniqueSlug added, if any, so the
 * display name matches. `beginner` → `beginner-2` returns "(2)"; no
 * suffix returns null.
 */
function suffixFromSlug(originalSlug: string, uniqueSlug: string): string | null {
  if (originalSlug === uniqueSlug) return null
  const suffix = uniqueSlug.slice(originalSlug.length)
  const match = /^-(\d+)$/.exec(suffix)
  if (!match) return null
  return `(${match[1]})`
}

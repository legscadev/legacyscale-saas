// Clone a company's content into another company. Powers /super
// create-with-clone and the row-level "Clone into…" action.
//
// Two axes:
//   1. Template content (categories, courses, trainings, quiz
//      questions, lesson resources, statistics, org board, onboarding
//      checklists) — safe to clone across tenants.
//   2. People (members, team) — copies CompanyMembership rows so the
//      same users gain access to the target tenant. No user rows are
//      created; the recipient's Supabase Auth account stays theirs.
//
// Explicitly NOT cloned (per-user history — cloning would nonsense):
//   - Enrollments, LessonProgress, QuizAttempts, CertificateIssuances
//   - Announcements, Nudges, Notes, StatDataPoints
//   - Employees, PositionAssignments, EmployeeChecklistItemStatus
//   - OrgNodeAuditLog
//   - Mux assets + LessonResource files (metadata rows are cloned,
//     the actual file bytes stay in the source bucket path)
//
// Slug uniqueness: Course.slug + Membership.slug are still globally
// unique in the schema (per-tenant unique migration deferred).
// ensureUniqueSlug walks slug → slug-2 → slug-3 … until it finds a
// free one, and mirrors the suffix into name/title for readability.

import { Prisma } from '@prisma/client'
import type { CompanyRole } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { runAsSuperAdmin } from '@/lib/tenancy/request-company'

export interface SnapshotSummary {
  membershipsCopied: number
  coursesCopied: number
  trainingsCopied: number
  modulesCopied: number
  chaptersCopied: number
  lessonsCopied: number
  quizQuestionsCopied: number
  lessonResourcesCopied: number
  statDivisionsCopied: number
  statMetricsCopied: number
  orgRevisionsCopied: number
  orgNodesCopied: number
  positionDetailsCopied: number
  onboardingItemsCopied: number
  membersCopied: number
  teamCopied: number
}

export interface SnapshotOptions {
  sourceCompanyId: string
  targetCompanyId: string
  /** Memberships (name + slug + description). Course→membership links
   *  are re-mapped when a course is also cloned. Default true. */
  includeMemberships?: boolean
  /** Courses aimed at members (audience MEMBERS or BOTH) plus their
   *  modules, chapters, lessons, quiz questions, and lesson-resource
   *  metadata. Cloned as DRAFT. Default true. */
  includeCourses?: boolean
  /** Internal-team trainings (audience INTERNAL or BOTH) — same
   *  cascade as courses. A BOTH-audience course cloned via both
   *  flags is a single row on the target; counts in both totals for
   *  operator clarity. Default false. */
  includeTrainings?: boolean
  /** Statistics template: divisions + metrics. StatDataPoints (the
   *  recorded values) are per-tenant history and never clone. */
  includeStatistics?: boolean
  /** Org board template: revisions + nodes + position details. Node
   *  employeeId references clear on clone; PositionAssignment rows
   *  (per-user) don't come along. */
  includeOrgBoard?: boolean
  /** Onboarding checklist item templates. Per-employee status rows
   *  don't clone. */
  includeOnboardingChecklists?: boolean
  /** Copy CompanyMembership rows for MEMBER-role users. The same
   *  Supabase Auth users gain access to the target tenant — no user
   *  rows are created. Default false. */
  includeMembers?: boolean
  /** Copy CompanyMembership rows for TEAM + ADMIN role users. OWNER
   *  rows never clone — ownership is per-tenant by design. Default
   *  false. */
  includeTeam?: boolean
}

/** Zeroed-out summary — used as the starting point for the running
 *  counter and returned when every flag is off. */
const EMPTY_SUMMARY: SnapshotSummary = {
  membershipsCopied: 0,
  coursesCopied: 0,
  trainingsCopied: 0,
  modulesCopied: 0,
  chaptersCopied: 0,
  lessonsCopied: 0,
  quizQuestionsCopied: 0,
  lessonResourcesCopied: 0,
  statDivisionsCopied: 0,
  statMetricsCopied: 0,
  orgRevisionsCopied: 0,
  orgNodesCopied: 0,
  positionDetailsCopied: 0,
  onboardingItemsCopied: 0,
  membersCopied: 0,
  teamCopied: 0,
}

export async function snapshotCompany(
  options: SnapshotOptions,
): Promise<SnapshotSummary> {
  const {
    sourceCompanyId,
    targetCompanyId,
    includeMemberships = true,
    includeCourses = true,
    includeTrainings = false,
    includeStatistics = false,
    includeOrgBoard = false,
    includeOnboardingChecklists = false,
    includeMembers = false,
    includeTeam = false,
  } = options

  if (sourceCompanyId === targetCompanyId) {
    throw new Error('Refusing to snapshot a company into itself')
  }

  const anythingChecked =
    includeMemberships ||
    includeCourses ||
    includeTrainings ||
    includeStatistics ||
    includeOrgBoard ||
    includeOnboardingChecklists ||
    includeMembers ||
    includeTeam
  if (!anythingChecked) return { ...EMPTY_SUMMARY }

  // Which Course.audience values need pulling. Empty array = don't
  // fetch courses at all. BOTH-audience courses appear in either
  // fetch and are de-duped by id before the write loop.
  const audienceFilter: string[] = []
  if (includeCourses) audienceFilter.push('MEMBERS', 'BOTH')
  if (includeTrainings) audienceFilter.push('INTERNAL', 'BOTH')
  const uniqueAudiences = Array.from(new Set(audienceFilter))
  const fetchCourses = uniqueAudiences.length > 0

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

    // ── Bulk-load source content up front so the transaction writes
    //    without re-reading. Every branch is optional; disabled ones
    //    resolve to empty arrays to keep the transaction body linear.
    const [
      memberships,
      courses,
      statDivisions,
      orgRevisions,
      onboardingItems,
      companyMemberships,
    ] = await Promise.all([
      includeMemberships
        ? prisma.membership.findMany({
            where: { companyId: sourceCompanyId },
            orderBy: { createdAt: 'asc' },
          })
        : Promise.resolve([]),
      fetchCourses
        ? prisma.course.findMany({
            where: {
              companyId: sourceCompanyId,
              deletedAt: null,
              audience: { in: uniqueAudiences as never[] },
            },
            orderBy: { orderIndex: 'asc' },
            include: {
              memberships: { select: { membershipId: true } },
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
                    include: {
                      quizQuestions: {
                        orderBy: { orderIndex: 'asc' },
                      },
                      resources: {
                        orderBy: { createdAt: 'asc' },
                      },
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve([]),
      includeStatistics
        ? prisma.statDivision.findMany({
            where: { companyId: sourceCompanyId, deletedAt: null },
            orderBy: { orderIndex: 'asc' },
            include: {
              metrics: {
                where: { deletedAt: null },
                orderBy: { orderIndex: 'asc' },
              },
            },
          })
        : Promise.resolve([]),
      includeOrgBoard
        ? prisma.orgBoardRevision.findMany({
            where: { companyId: sourceCompanyId },
            orderBy: { createdAt: 'asc' },
            include: {
              nodes: {
                orderBy: { createdAt: 'asc' },
                include: {
                  positionDetail: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      includeOnboardingChecklists
        ? prisma.onboardingChecklistItem.findMany({
            where: { companyId: sourceCompanyId },
            orderBy: { orderIndex: 'asc' },
          })
        : Promise.resolve([]),
      includeMembers || includeTeam
        ? prisma.companyMembership.findMany({
            where: {
              companyId: sourceCompanyId,
              role: {
                in: [
                  ...(includeMembers ? (['MEMBER'] as CompanyRole[]) : []),
                  ...(includeTeam
                    ? (['TEAM', 'ADMIN'] as CompanyRole[])
                    : []),
                ],
              },
            },
            select: { userId: true, role: true },
          })
        : Promise.resolve([]),
    ])

    return prisma.$transaction(
      async (tx) => {
        const summary: SnapshotSummary = { ...EMPTY_SUMMARY }
        const membershipIdMap = new Map<string, string>()

        // 1. Memberships
        for (const tier of memberships) {
          const uniqueSlug = await ensureUniqueSlug('membership', tx, tier.slug)
          const suffix = suffixFromSlug(tier.slug, uniqueSlug)
          const uniqueName = suffix ? `${tier.name} ${suffix}` : tier.name
          const created = await tx.membership.create({
            data: {
              name: uniqueName,
              slug: uniqueSlug,
              description: tier.description,
              companyId: targetCompanyId,
            },
            select: { id: true },
          })
          membershipIdMap.set(tier.id, created.id)
        }
        summary.membershipsCopied = membershipIdMap.size

        // 2. Courses + Trainings (same Course model, different audiences)
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

          // Count once per axis — BOTH-audience shows in both totals.
          if (course.audience === 'MEMBERS' || course.audience === 'BOTH') {
            summary.coursesCopied += 1
          }
          if (course.audience === 'INTERNAL' || course.audience === 'BOTH') {
            summary.trainingsCopied += 1
          }

          // Membership links — only for tiers we cloned.
          for (const link of course.memberships) {
            const mappedMembershipId = membershipIdMap.get(link.membershipId)
            if (!mappedMembershipId) continue
            await tx.courseMembership.create({
              data: {
                courseId: created.id,
                membershipId: mappedMembershipId,
                companyId: targetCompanyId,
              },
            })
          }

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
            summary.modulesCopied += 1
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
            summary.chaptersCopied += 1

            for (const lesson of chapter.lessons) {
              const lessonCreated = await tx.lesson.create({
                data: {
                  chapterId: chapterCreated.id,
                  title: lesson.title,
                  description: lesson.description,
                  type: lesson.type,
                  // Reset to DRAFT — no mux asset was carried over, so
                  // even VIDEO lessons need to be re-uploaded.
                  status: 'DRAFT' as const,
                  orderIndex: lesson.orderIndex,
                  companyId: targetCompanyId,
                },
                select: { id: true },
              })
              summary.lessonsCopied += 1

              if (lesson.quizQuestions.length > 0) {
                await tx.quizQuestion.createMany({
                  data: lesson.quizQuestions.map((q) => ({
                    lessonId: lessonCreated.id,
                    questionText: q.questionText,
                    type: q.type,
                    options: q.options as Prisma.InputJsonValue,
                    correctIndex: q.correctIndex,
                    explanation: q.explanation,
                    orderIndex: q.orderIndex,
                    companyId: targetCompanyId,
                  })),
                })
                summary.quizQuestionsCopied += lesson.quizQuestions.length
              }

              if (lesson.resources.length > 0) {
                // Only metadata clones — file bytes stay in the source
                // bucket; the target's admin will need to re-upload if
                // they want the files usable.
                await tx.lessonResource.createMany({
                  data: lesson.resources.map((r) => ({
                    lessonId: lessonCreated.id,
                    name: r.name,
                    path: r.path,
                    size: r.size,
                    mimeType: r.mimeType,
                    companyId: targetCompanyId,
                  })),
                })
                summary.lessonResourcesCopied += lesson.resources.length
              }
            }
          }
        }

        // 3. Statistics (divisions + metrics only — datapoints stay)
        for (const div of statDivisions) {
          const divCreated = await tx.statDivision.create({
            data: {
              name: div.name,
              shortLabel: div.shortLabel,
              description: div.description,
              orderIndex: div.orderIndex,
              companyId: targetCompanyId,
            },
            select: { id: true },
          })
          summary.statDivisionsCopied += 1

          for (const m of div.metrics) {
            await tx.statMetric.create({
              data: {
                divisionId: divCreated.id,
                name: m.name,
                description: m.description,
                unit: m.unit,
                // assignedToId intentionally dropped — assignments
                // are user-specific and don't clone.
                orderIndex: m.orderIndex,
                targetValue: m.targetValue,
                companyId: targetCompanyId,
              },
            })
            summary.statMetricsCopied += 1
          }
        }

        // 4. Org board (revisions → nodes → position details)
        for (const rev of orgRevisions) {
          const revCreated = await tx.orgBoardRevision.create({
            data: {
              name: rev.name,
              description: rev.description,
              // isCurrent + publishedAt reset — the clone starts as a
              // fresh unpublished revision on the target so the
              // recipient can review before flipping.
              isCurrent: false,
              publishedAt: null,
              // createdById dropped — the recipient tenant will show
              // "System" as the author.
              companyId: targetCompanyId,
            },
            select: { id: true },
          })
          summary.orgRevisionsCopied += 1

          // Nodes form a tree (parentId → id). Insert in two passes:
          // first every node with parentId=null (root), then
          // remainder in a stable order once parents exist. In
          // practice orgnodes rarely nest more than 4 deep so a
          // simple topological sort by BFS suffices.
          const nodeIdMap = new Map<string, string>()
          const remaining = [...rev.nodes]
          let safety = 0
          while (remaining.length > 0 && safety++ < 1000) {
            const insertable = remaining.filter(
              (n) => n.parentId === null || nodeIdMap.has(n.parentId),
            )
            if (insertable.length === 0) {
              // Orphan cycle or dangling parent — bail rather than loop.
              break
            }
            for (const n of insertable) {
              const created = await tx.orgNode.create({
                data: {
                  revisionId: revCreated.id,
                  parentId: n.parentId ? nodeIdMap.get(n.parentId)! : null,
                  kind: n.kind,
                  label: n.label,
                  deptNumber: n.deptNumber,
                  positionTitle: n.positionTitle,
                  // employeeId dropped — the seat unbinds on clone.
                  functionText: n.functionText,
                  responsibilities: n.responsibilities,
                  notes: n.notes,
                  color: n.color,
                  orderIndex: n.orderIndex,
                  companyId: targetCompanyId,
                },
                select: { id: true },
              })
              nodeIdMap.set(n.id, created.id)
              summary.orgNodesCopied += 1

              if (n.positionDetail) {
                const pd = n.positionDetail
                await tx.positionDetail.create({
                  data: {
                    nodeId: created.id,
                    code: pd.code,
                    level: pd.level,
                    headcountMin: pd.headcountMin,
                    headcountMax: pd.headcountMax,
                    employmentType: pd.employmentType,
                    kpis: pd.kpis,
                    requirements: pd.requirements,
                    companyId: targetCompanyId,
                  },
                })
                summary.positionDetailsCopied += 1
              }
            }
            for (const n of insertable) {
              const idx = remaining.indexOf(n)
              if (idx >= 0) remaining.splice(idx, 1)
            }
          }
        }

        // 5. Onboarding checklist items. orderIndex is @unique
        // globally (not per-tenant) in the schema, so we offset the
        // cloned rows past the current max on the target to avoid
        // colliding with anything the target already has.
        if (onboardingItems.length > 0) {
          const maxRow = await tx.onboardingChecklistItem.findFirst({
            orderBy: { orderIndex: 'desc' },
            select: { orderIndex: true },
          })
          const baseOffset = (maxRow?.orderIndex ?? -1) + 1
          for (let i = 0; i < onboardingItems.length; i++) {
            const item = onboardingItems[i]!
            await tx.onboardingChecklistItem.create({
              data: {
                label: item.label,
                description: item.description,
                orderIndex: baseOffset + i,
                companyId: targetCompanyId,
              },
            })
            summary.onboardingItemsCopied += 1
          }
        }

        // 6. People — upsert CompanyMembership per user. OWNER role
        //    is never copied even when the source has multiple owners.
        for (const m of companyMemberships) {
          await tx.companyMembership.upsert({
            where: {
              userId_companyId: {
                userId: m.userId,
                companyId: targetCompanyId,
              },
            },
            update: {},
            create: {
              userId: m.userId,
              companyId: targetCompanyId,
              role: m.role,
            },
          })
          if (m.role === 'MEMBER') summary.membersCopied += 1
          else summary.teamCopied += 1
        }

        return summary
      },
      { maxWait: 10_000, timeout: 240_000 },
    )
  })
}

// ═══════════════════════════════════════════════════════════════
// INTERNALS
// ═══════════════════════════════════════════════════════════════

/**
 * Find the next free slug in the shape `base`, `base-2`, `base-3`…
 * Runs a series of point-selects rather than one greedy LIKE query,
 * so it plays nicely with transaction isolation. Terminates at 500
 * attempts — beyond that something is very wrong.
 */
async function ensureUniqueSlug(
  kind: 'course' | 'membership',
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
        : await tx.membership.findFirst({
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

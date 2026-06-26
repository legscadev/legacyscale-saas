import type { CourseAudience, Prisma } from '@prisma/client'

/**
 * Resolved per-member visibility envelope. Two consumer shapes:
 *  - `categoryAccessWhere` for Prisma `course.findMany` calls
 *  - `bypassesCategoryGate` + `memberCategoryId` for in-memory checks
 *    where the course already has `isFree` + categories hydrated
 */
export interface MemberAccess {
  /** Course audiences this member is allowed to see, derived from role. */
  visibleAudiences: CourseAudience[]
  /** Prisma WHERE fragment that gates which courses the member can see
   *  based on their assigned category (and the free bypass). Spread
   *  into a `course.findMany` where clause. ADMIN and TEAM roles get
   *  an empty object — they see every course. */
  categoryAccessWhere: Prisma.CourseWhereInput
  /** True when role bypasses the member-tier category filter. */
  bypassesCategoryGate: boolean
  /** The member's assigned category, when role doesn't bypass. */
  memberCategoryId: string | null
}

/**
 * Build the OR-branch that gates which courses a member-tier user can
 * see. Two ways a course slips past the gate:
 *   - It's marked isFree (free for everyone, regardless of category).
 *   - The member has a category and the course shares it.
 * Members with no category assigned only see free courses.
 * Uncategorised paid courses are hidden from MEMBER role; ADMIN/TEAM
 * still see them via the bypass branch in resolveMemberAccess.
 */
export function buildMemberCategoryAccessWhere(
  categoryId: string | null,
): Prisma.CourseWhereInput {
  const branches: Prisma.CourseWhereInput[] = [{ isFree: true }]
  if (categoryId) {
    branches.push({ categories: { some: { categoryId } } })
  }
  return { OR: branches }
}

/**
 * In-memory mirror of `buildMemberCategoryAccessWhere` for callers
 * that already have the course's isFree + categories loaded (e.g.
 * the lesson-access guard inside markLessonProgress / submitQuiz).
 * Saves a second DB round-trip per request.
 */
export function passesMemberCategoryGate(
  access: MemberAccess,
  course: { isFree: boolean; categories: { categoryId: string }[] },
): boolean {
  if (access.bypassesCategoryGate) return true
  if (course.isFree) return true
  if (
    access.memberCategoryId &&
    course.categories.some((c) => c.categoryId === access.memberCategoryId)
  ) {
    return true
  }
  return false
}

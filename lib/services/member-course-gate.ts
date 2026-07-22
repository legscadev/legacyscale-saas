import type { CourseAudience, Prisma } from '@prisma/client'

/**
 * Resolved per-member visibility envelope. Two consumer shapes:
 *  - `membershipAccessWhere` for Prisma `course.findMany` calls
 *  - `bypassesMembershipGate` + `memberMembershipId` for in-memory
 *    checks where the course already has `isFree` + memberships
 *    hydrated
 */
export interface MemberAccess {
  /** Course audiences this member is allowed to see, derived from role. */
  visibleAudiences: CourseAudience[]
  /** Prisma WHERE fragment that gates which courses the member can see
   *  based on their assigned membership tier (and the free bypass).
   *  Spread into a `course.findMany` where clause. ADMIN and TEAM
   *  roles get an empty object — they see every course. */
  membershipAccessWhere: Prisma.CourseWhereInput
  /** True when role bypasses the member-tier gate. */
  bypassesMembershipGate: boolean
  /** The member's assigned membership tier, when role doesn't bypass. */
  memberMembershipId: string | null
}

/**
 * Build the OR-branch that gates which courses a member-tier user can
 * see. Two ways a course slips past the gate:
 *   - It's marked isFree (free for everyone, regardless of tier).
 *   - The member has a tier and the course shares it.
 * Members with no tier assigned only see free courses.
 * Uncategorised paid courses are hidden from MEMBER role; ADMIN/TEAM
 * still see them via the bypass branch in resolveMemberAccess.
 */
export function buildMemberMembershipAccessWhere(
  membershipId: string | null,
): Prisma.CourseWhereInput {
  const branches: Prisma.CourseWhereInput[] = [{ isFree: true }]
  if (membershipId) {
    branches.push({ memberships: { some: { membershipId } } })
  }
  return { OR: branches }
}

/**
 * In-memory mirror of `buildMemberMembershipAccessWhere` for callers
 * that already have the course's isFree + memberships loaded (e.g.
 * the lesson-access guard inside markLessonProgress / submitQuiz).
 * Saves a second DB round-trip per request.
 */
export function passesMemberMembershipGate(
  access: MemberAccess,
  course: { isFree: boolean; memberships: { membershipId: string }[] },
): boolean {
  if (access.bypassesMembershipGate) return true
  if (course.isFree) return true
  if (
    access.memberMembershipId &&
    course.memberships.some((m) => m.membershipId === access.memberMembershipId)
  ) {
    return true
  }
  return false
}

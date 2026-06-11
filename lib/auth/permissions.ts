import type { CourseAudience, Role } from '@prisma/client'

/**
 * Course audiences a given role is allowed to discover via the member
 * catalog. ADMIN and TEAM see everything (members courses + internal
 * courses + both-audience courses). Plain MEMBER only sees content
 * marked for them.
 *
 * Used by member-course-service to gate listCatalog / getById /
 * ensureEnrollment / etc.
 */
export function visibleAudiencesFor(role: Role): CourseAudience[] {
  if (role === 'ADMIN' || role === 'TEAM') {
    return ['MEMBERS', 'INTERNAL', 'BOTH']
  }
  return ['MEMBERS', 'BOTH']
}

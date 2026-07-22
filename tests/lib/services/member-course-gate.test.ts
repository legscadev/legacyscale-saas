import { describe, it, expect } from 'vitest'

import {
  buildMemberMembershipAccessWhere,
  passesMemberMembershipGate,
  type MemberAccess,
} from '@/lib/services/member-course-gate'

const MARKETING = 'cat-marketing-uuid'
const SALES = 'cat-sales-uuid'

function memberAccess(overrides: Partial<MemberAccess> = {}): MemberAccess {
  return {
    visibleAudiences: ['MEMBERS', 'BOTH'],
    membershipAccessWhere: {},
    bypassesMembershipGate: false,
    memberMembershipId: null,
    ...overrides,
  }
}

describe('buildMemberMembershipAccessWhere', () => {
  it('returns just the isFree branch when the member has no category', () => {
    expect(buildMemberMembershipAccessWhere(null)).toEqual({
      OR: [{ isFree: true }],
    })
  })

  it('adds a category-match branch when the member has a category', () => {
    expect(buildMemberMembershipAccessWhere(MARKETING)).toEqual({
      OR: [
        { isFree: true },
        { memberships: { some: { membershipId: MARKETING } } },
      ],
    })
  })

  it('does not include an uncategorised-bypass branch (no `memberships: { none: {} }`)', () => {
    // Regression guard for the 2026-06-26 tightening — previously
    // uncategorised paid courses leaked through to all members.
    const where = buildMemberMembershipAccessWhere(MARKETING)
    expect(JSON.stringify(where)).not.toContain('"none"')
  })
})

describe('passesMemberMembershipGate', () => {
  describe('ADMIN/TEAM bypass', () => {
    it('lets a staff role through any paid uncategorised course', () => {
      const access = memberAccess({ bypassesMembershipGate: true })
      expect(
        passesMemberMembershipGate(access, { isFree: false, memberships: [] }),
      ).toBe(true)
    })

    it('lets a staff role through a paid mismatched-category course', () => {
      const access = memberAccess({
        bypassesMembershipGate: true,
        memberMembershipId: null,
      })
      expect(
        passesMemberMembershipGate(access, {
          isFree: false,
          memberships: [{ membershipId: SALES }],
        }),
      ).toBe(true)
    })
  })

  describe('isFree bypass', () => {
    it('lets any member open a free course regardless of category', () => {
      const access = memberAccess({ memberMembershipId: null })
      expect(
        passesMemberMembershipGate(access, {
          isFree: true,
          memberships: [{ membershipId: SALES }],
        }),
      ).toBe(true)
    })

    it('lets a categorised member open a free uncategorised course', () => {
      const access = memberAccess({ memberMembershipId: MARKETING })
      expect(
        passesMemberMembershipGate(access, {
          isFree: true,
          memberships: [],
        }),
      ).toBe(true)
    })
  })

  describe('category match', () => {
    it('passes when the member category matches one of the course categories', () => {
      const access = memberAccess({ memberMembershipId: MARKETING })
      expect(
        passesMemberMembershipGate(access, {
          isFree: false,
          memberships: [{ membershipId: MARKETING }],
        }),
      ).toBe(true)
    })

    it('passes when the course has multiple categories and one matches', () => {
      const access = memberAccess({ memberMembershipId: MARKETING })
      expect(
        passesMemberMembershipGate(access, {
          isFree: false,
          memberships: [{ membershipId: SALES }, { membershipId: MARKETING }],
        }),
      ).toBe(true)
    })
  })

  describe('rejection paths', () => {
    it('blocks a no-category member from a paid course (no isFree, no match)', () => {
      const access = memberAccess({ memberMembershipId: null })
      expect(
        passesMemberMembershipGate(access, {
          isFree: false,
          memberships: [{ membershipId: MARKETING }],
        }),
      ).toBe(false)
    })

    it('blocks a no-category member from a paid uncategorised course', () => {
      const access = memberAccess({ memberMembershipId: null })
      expect(
        passesMemberMembershipGate(access, {
          isFree: false,
          memberships: [],
        }),
      ).toBe(false)
    })

    it('blocks a mismatched-category member from a paid gated course', () => {
      const access = memberAccess({ memberMembershipId: SALES })
      expect(
        passesMemberMembershipGate(access, {
          isFree: false,
          memberships: [{ membershipId: MARKETING }],
        }),
      ).toBe(false)
    })

    it('blocks a categorised member from a paid uncategorised course', () => {
      // Regression guard for the same 2026-06-26 tightening — paid
      // uncategorised courses are admin-only now.
      const access = memberAccess({ memberMembershipId: MARKETING })
      expect(
        passesMemberMembershipGate(access, {
          isFree: false,
          memberships: [],
        }),
      ).toBe(false)
    })
  })
})

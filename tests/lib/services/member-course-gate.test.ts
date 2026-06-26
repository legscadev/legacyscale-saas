import { describe, it, expect } from 'vitest'

import {
  buildMemberCategoryAccessWhere,
  passesMemberCategoryGate,
  type MemberAccess,
} from '@/lib/services/member-course-gate'

const MARKETING = 'cat-marketing-uuid'
const SALES = 'cat-sales-uuid'

function memberAccess(overrides: Partial<MemberAccess> = {}): MemberAccess {
  return {
    visibleAudiences: ['MEMBERS', 'BOTH'],
    categoryAccessWhere: {},
    bypassesCategoryGate: false,
    memberCategoryId: null,
    ...overrides,
  }
}

describe('buildMemberCategoryAccessWhere', () => {
  it('returns just the isFree branch when the member has no category', () => {
    expect(buildMemberCategoryAccessWhere(null)).toEqual({
      OR: [{ isFree: true }],
    })
  })

  it('adds a category-match branch when the member has a category', () => {
    expect(buildMemberCategoryAccessWhere(MARKETING)).toEqual({
      OR: [
        { isFree: true },
        { categories: { some: { categoryId: MARKETING } } },
      ],
    })
  })

  it('does not include an uncategorised-bypass branch (no `categories: { none: {} }`)', () => {
    // Regression guard for the 2026-06-26 tightening — previously
    // uncategorised paid courses leaked through to all members.
    const where = buildMemberCategoryAccessWhere(MARKETING)
    expect(JSON.stringify(where)).not.toContain('"none"')
  })
})

describe('passesMemberCategoryGate', () => {
  describe('ADMIN/TEAM bypass', () => {
    it('lets a staff role through any paid uncategorised course', () => {
      const access = memberAccess({ bypassesCategoryGate: true })
      expect(
        passesMemberCategoryGate(access, { isFree: false, categories: [] }),
      ).toBe(true)
    })

    it('lets a staff role through a paid mismatched-category course', () => {
      const access = memberAccess({
        bypassesCategoryGate: true,
        memberCategoryId: null,
      })
      expect(
        passesMemberCategoryGate(access, {
          isFree: false,
          categories: [{ categoryId: SALES }],
        }),
      ).toBe(true)
    })
  })

  describe('isFree bypass', () => {
    it('lets any member open a free course regardless of category', () => {
      const access = memberAccess({ memberCategoryId: null })
      expect(
        passesMemberCategoryGate(access, {
          isFree: true,
          categories: [{ categoryId: SALES }],
        }),
      ).toBe(true)
    })

    it('lets a categorised member open a free uncategorised course', () => {
      const access = memberAccess({ memberCategoryId: MARKETING })
      expect(
        passesMemberCategoryGate(access, {
          isFree: true,
          categories: [],
        }),
      ).toBe(true)
    })
  })

  describe('category match', () => {
    it('passes when the member category matches one of the course categories', () => {
      const access = memberAccess({ memberCategoryId: MARKETING })
      expect(
        passesMemberCategoryGate(access, {
          isFree: false,
          categories: [{ categoryId: MARKETING }],
        }),
      ).toBe(true)
    })

    it('passes when the course has multiple categories and one matches', () => {
      const access = memberAccess({ memberCategoryId: MARKETING })
      expect(
        passesMemberCategoryGate(access, {
          isFree: false,
          categories: [{ categoryId: SALES }, { categoryId: MARKETING }],
        }),
      ).toBe(true)
    })
  })

  describe('rejection paths', () => {
    it('blocks a no-category member from a paid course (no isFree, no match)', () => {
      const access = memberAccess({ memberCategoryId: null })
      expect(
        passesMemberCategoryGate(access, {
          isFree: false,
          categories: [{ categoryId: MARKETING }],
        }),
      ).toBe(false)
    })

    it('blocks a no-category member from a paid uncategorised course', () => {
      const access = memberAccess({ memberCategoryId: null })
      expect(
        passesMemberCategoryGate(access, {
          isFree: false,
          categories: [],
        }),
      ).toBe(false)
    })

    it('blocks a mismatched-category member from a paid gated course', () => {
      const access = memberAccess({ memberCategoryId: SALES })
      expect(
        passesMemberCategoryGate(access, {
          isFree: false,
          categories: [{ categoryId: MARKETING }],
        }),
      ).toBe(false)
    })

    it('blocks a categorised member from a paid uncategorised course', () => {
      // Regression guard for the same 2026-06-26 tightening — paid
      // uncategorised courses are admin-only now.
      const access = memberAccess({ memberCategoryId: MARKETING })
      expect(
        passesMemberCategoryGate(access, {
          isFree: false,
          categories: [],
        }),
      ).toBe(false)
    })
  })
})

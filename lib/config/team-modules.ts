// Canonical catalog of gate-able Internal admin modules.
//
// A module here is a top-level surface in the admin sidebar's
// "Internal" section that TEAM staff can be granted access to on
// a per-user basis. ADMIN role always has access to all modules;
// MEMBER role never does. TEAM sits in the middle and is what
// this catalog controls.
//
// Keys are short slugs (not URLs) so a route rename doesn't
// invalidate every existing grant row. When adding a new gate-able
// module: add it here, then apply requireTeamModuleAccess() in the
// route's server component. The sidebar filter (Phase 2.1) reads
// this catalog to know which nav items are gate-able.

import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  BookText,
  CheckSquare,
  GraduationCap,
  Network,
  UserPlus,
  Users,
} from 'lucide-react'

/** Slug identifier for one gate-able module. Stored on
 *  TeamModuleGrant.moduleKey. */
export type TeamModuleKey =
  | 'team'
  | 'tasks'
  | 'policies'
  | 'trainings'
  | 'stats'
  | 'org-board'
  | 'onboarding'

export interface TeamModuleDef {
  key: TeamModuleKey
  /** Display label — same wording as the sidebar. */
  label: string
  /** URL prefix. The auth gate treats any route starting with
   *  this href as belonging to the module. */
  href: string
  /** Icon reused from the sidebar so the AccessGridDialog has
   *  visual continuity. */
  icon: LucideIcon
  /** One-line description surfaced in the grant grid so admins
   *  know what they're granting without visiting the module. */
  description: string
}

/**
 * All modules a TEAM user can be granted access to. Order matches
 * the sidebar for visual consistency. Adding a new item here
 * automatically surfaces it in the grid + filter — but you still
 * need to apply requireTeamModuleAccess() on the corresponding
 * route.
 */
export const TEAM_MODULES: readonly TeamModuleDef[] = [
  {
    key: 'team',
    label: 'Team',
    href: '/admin/team',
    icon: Users,
    description: 'View admins, staff, and everyone with a role behind the scenes.',
  },
  {
    key: 'tasks',
    label: 'Task Tracker',
    href: '/admin/tasks',
    icon: CheckSquare,
    description: 'Track internal work — create, assign, and hand off tasks.',
  },
  {
    key: 'policies',
    label: 'Policies',
    href: '/admin/policies',
    icon: BookText,
    description: 'Read role hats, processes, systems, and onboarding docs.',
  },
  {
    key: 'trainings',
    label: 'Trainings',
    href: '/admin/trainings',
    icon: GraduationCap,
    description: 'Access internal-team training programs and materials.',
  },
  {
    key: 'stats',
    label: 'Statistics',
    href: '/admin/stats',
    icon: BarChart3,
    description: 'Review operational metrics across divisions.',
  },
  {
    key: 'org-board',
    label: 'Organization Board',
    href: '/admin/org-board',
    icon: Network,
    description: 'See the organization structure and role assignments.',
  },
  {
    key: 'onboarding',
    label: 'Onboarding',
    href: '/admin/onboarding',
    icon: UserPlus,
    description: 'Track new-hire onboarding progress and checklists.',
  },
] as const

/** Set-based membership check — cheap way to know whether a given
 *  moduleKey is a real gate-able module (rejects typos + drift
 *  from stored grants). */
const KEY_SET = new Set<string>(TEAM_MODULES.map((m) => m.key))
export function isKnownTeamModuleKey(key: string): key is TeamModuleKey {
  return KEY_SET.has(key)
}

/** All the keys as a plain array — used by the backfill migration
 *  + the "grant everything" default. */
export const ALL_TEAM_MODULE_KEYS: readonly TeamModuleKey[] = TEAM_MODULES.map(
  (m) => m.key,
)

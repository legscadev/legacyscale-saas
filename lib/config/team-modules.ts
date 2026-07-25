// Canonical catalog of gate-able admin/team modules.
//
// A module here is a top-level surface in the admin (or team-portal)
// sidebar that can be gated per role. Roles (see /admin/roles) hold
// permissions keyed by moduleKey; a user's effective access is the
// union across every role they hold. ADMIN tier bypasses the check
// entirely; MEMBER tier never has access.
//
// Keys are short slugs (not URLs) so a route rename doesn't
// invalidate every existing permission row. When adding a new
// gate-able module: add it here, then apply requireTeamModuleAccess()
// in the route's server component. The sidebar filter reads this
// catalog to know which nav items are gate-able.

import type { LucideIcon } from 'lucide-react'
import {
  Award,
  BarChart3,
  BookText,
  CheckSquare,
  ClipboardList,
  GraduationCap,
  Megaphone,
  Network,
  PhoneCall,
  Settings,
  ShieldPlus,
  Tag,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react'

/** Slug identifier for one gate-able module. Stored on
 *  RolePermission.moduleKey. */
export type TeamModuleKey =
  // Learning section
  | 'courses'
  | 'membership'
  | 'certificates'
  | 'progress'
  // Community section
  | 'students'
  | 'announcements'
  // Internal section
  | 'team'
  | 'tasks'
  | 'policies'
  | 'trainings'
  | 'stats'
  | 'org-board'
  | 'onboarding'
  | 'production'
  // System section
  | 'activity'
  | 'roles'
  | 'settings'

/** Sidebar section the module lives under. Purely presentational —
 *  used by the roles matrix to group columns and by the sidebar
 *  itself for the section headings. */
export type ModuleSection = 'Learning' | 'Community' | 'Internal' | 'System'

export interface TeamModuleDef {
  key: TeamModuleKey
  /** Sidebar section — drives column grouping in the roles matrix
   *  and the sidebar section header the item lives under. */
  section: ModuleSection
  /** Display label — same wording as the sidebar. */
  label: string
  /** URL prefix. The auth gate treats any route starting with
   *  this href as belonging to the module. */
  href: string
  /** Icon reused from the sidebar so the roles matrix has
   *  visual continuity. */
  icon: LucideIcon
  /** One-line description surfaced in the role editor + assignment
   *  dialogs so admins know what the module unlocks. */
  description: string
}

/**
 * Every gate-able module in the app. Order matches the sidebar for
 * visual consistency. Adding a new item here automatically surfaces
 * it in the roles matrix + sidebar filter — but you still need to
 * apply requireTeamModuleAccess() on the corresponding route.
 */
export const TEAM_MODULES: readonly TeamModuleDef[] = [
  // Learning ─────────────────────────────
  {
    key: 'courses',
    section: 'Learning',
    label: 'Courses',
    href: '/admin/courses',
    icon: GraduationCap,
    description: 'Design and publish member-facing courses + lessons.',
  },
  {
    key: 'membership',
    section: 'Learning',
    label: 'Membership',
    href: '/admin/membership',
    icon: Tag,
    description: 'Manage membership tiers that gate course access.',
  },
  {
    key: 'certificates',
    section: 'Learning',
    label: 'Certificates',
    href: '/admin/certificates',
    icon: Award,
    description: 'Issue, revoke, and configure course-completion certificates.',
  },
  {
    key: 'progress',
    section: 'Learning',
    label: 'Progress Tracker',
    href: '/admin/progress',
    icon: TrendingUp,
    description: 'Track member progress across courses and lessons.',
  },
  // Community ────────────────────────────
  {
    key: 'students',
    section: 'Community',
    label: 'Students',
    href: '/admin/students',
    icon: Users,
    description: 'Manage student accounts, invites, and access.',
  },
  {
    key: 'announcements',
    section: 'Community',
    label: 'Announcements',
    href: '/admin/announcements',
    icon: Megaphone,
    description: 'Publish announcements to the member community.',
  },
  // Internal ─────────────────────────────
  {
    key: 'team',
    section: 'Internal',
    label: 'Team',
    href: '/admin/team',
    icon: Users,
    description: 'View admins, staff, and everyone with a role behind the scenes.',
  },
  {
    key: 'tasks',
    section: 'Internal',
    label: 'Task Tracker',
    href: '/admin/tasks',
    icon: CheckSquare,
    description: 'Track internal work — create, assign, and hand off tasks.',
  },
  {
    key: 'policies',
    section: 'Internal',
    label: 'Policies',
    href: '/admin/policies',
    icon: BookText,
    description: 'Read role hats, processes, systems, and onboarding docs.',
  },
  {
    key: 'trainings',
    section: 'Internal',
    label: 'Trainings',
    href: '/admin/trainings',
    icon: GraduationCap,
    description: 'Access internal-team training programs and materials.',
  },
  {
    key: 'stats',
    section: 'Internal',
    label: 'Statistics',
    href: '/admin/stats',
    icon: BarChart3,
    description: 'Review operational metrics across divisions.',
  },
  {
    key: 'org-board',
    section: 'Internal',
    label: 'Organization Board',
    href: '/admin/org-board',
    icon: Network,
    description: 'See the organization structure and role assignments.',
  },
  {
    key: 'onboarding',
    section: 'Internal',
    label: 'Onboarding',
    href: '/admin/onboarding',
    icon: UserPlus,
    description: 'Track new-hire onboarding progress and checklists.',
  },
  {
    key: 'production',
    section: 'Internal',
    label: 'Production Sheets',
    href: '/admin/production-sheets',
    icon: PhoneCall,
    description:
      'Setter/closer daily production sheet — calls, DMs, appointments, sales, and appointments log.',
  },
  // System ───────────────────────────────
  {
    key: 'activity',
    section: 'System',
    label: 'Activity log',
    href: '/admin/activity',
    icon: ClipboardList,
    description: 'Cross-domain audit trail of edits, moves, additions, and deletions.',
  },
  {
    key: 'roles',
    section: 'System',
    label: 'Roles',
    href: '/admin/roles',
    icon: ShieldPlus,
    description:
      'Manage custom roles + assign module permissions. High-trust — holders can grant any other module to any user.',
  },
  {
    key: 'settings',
    section: 'System',
    label: 'Settings',
    href: '/admin/settings',
    icon: Settings,
    description: 'Company-wide settings, branding, and integrations.',
  },
] as const

/** Section display order — matches the sidebar top to bottom. */
export const MODULE_SECTIONS: readonly ModuleSection[] = [
  'Learning',
  'Community',
  'Internal',
  'System',
] as const

/** Set-based membership check — cheap way to know whether a given
 *  moduleKey is a real gate-able module (rejects typos + drift
 *  from stored grants). */
const KEY_SET = new Set<string>(TEAM_MODULES.map((m) => m.key))
export function isKnownTeamModuleKey(key: string): key is TeamModuleKey {
  return KEY_SET.has(key)
}

/** All the keys as a plain array — used by the "Admin" seeded role
 *  and any "grant everything" default flow. */
export const ALL_TEAM_MODULE_KEYS: readonly TeamModuleKey[] = TEAM_MODULES.map(
  (m) => m.key,
)

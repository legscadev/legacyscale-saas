import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  BookText,
  Building2,
  CheckSquare,
  GraduationCap,
  LayoutDashboard,
  type LucideIcon,
  Megaphone,
  Network,
  Settings,
  ShieldCheck,
  Tag,
  TrendingUp,
  User,
  UserPlus,
  Users,
} from 'lucide-react'

export type NavRole = 'ADMIN' | 'TEAM' | 'MEMBER'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  /** Match the href exactly (used for section roots like /admin). */
  exact?: boolean
  badge?: string
  /** When set, only these roles see the item. Absent = visible to
   *  everyone the parent nav is shown to (backwards-compatible with
   *  every existing entry). Filter runs in AppShellInner using the
   *  user's role prop. */
  visibleTo?: NavRole[]
  /** When set, TEAM users only see this item if they hold the
   *  matching TeamModuleGrant. ADMIN always sees it regardless.
   *  Absent = no per-user gate (item is either always visible or
   *  gated solely by visibleTo). See lib/config/team-modules.ts
   *  for the catalog of module keys. */
  moduleKey?: string
}

export interface NavSection {
  label?: string
  items: NavItem[]
}

export const adminNav: NavSection[] = [
  {
    items: [{ label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Learning',
    items: [
      { label: 'Courses', href: '/admin/courses', icon: GraduationCap },
      { label: 'Categories', href: '/admin/categories', icon: Tag },
      { label: 'Certificates', href: '/admin/certificates', icon: Award },
      {
        label: 'Progress Tracker',
        href: '/admin/progress',
        icon: TrendingUp,
      },
    ],
  },
  {
    label: 'Community',
    items: [
      { label: 'Members', href: '/admin/members', icon: Users },
      { label: 'Announcements', href: '/admin/announcements', icon: Megaphone },
    ],
  },
  {
    label: 'Internal',
    // Every item here is tagged with a moduleKey so TEAM viewers
    // (who now can enter /admin/* via the loosened layout gate)
    // only see the modules their grants unlock. ADMIN sees all of
    // them regardless.
    items: [
      { label: 'Team', href: '/admin/team', icon: Users, moduleKey: 'team' },
      { label: 'Task Tracker', href: '/admin/tasks', icon: CheckSquare, moduleKey: 'tasks' },
      { label: 'Policies', href: '/admin/policies', icon: BookText, moduleKey: 'policies' },
      { label: 'Trainings', href: '/admin/trainings', icon: GraduationCap, moduleKey: 'trainings' },
      { label: 'Statistics', href: '/admin/stats', icon: BarChart3, moduleKey: 'stats' },
      { label: 'Organization Board', href: '/admin/org-board', icon: Network, moduleKey: 'org-board' },
      { label: 'Onboarding', href: '/admin/onboarding', icon: UserPlus, moduleKey: 'onboarding' },
    ],
  },
  {
    label: 'System',
    items: [{ label: 'Settings', href: '/admin/settings', icon: Settings }],
  },
]

export const superNav: NavSection[] = [
  {
    items: [
      {
        label: 'Overview',
        href: '/super',
        icon: LayoutDashboard,
        exact: true,
      },
    ],
  },
  {
    label: 'Platform',
    items: [
      { label: 'Companies', href: '/super/companies', icon: Building2 },
      { label: 'Super admins', href: '/super/super-admins', icon: ShieldCheck },
    ],
  },
  {
    label: 'System',
    items: [
      {
        label: 'Return to admin',
        href: '/admin/dashboard',
        icon: ShieldCheck,
      },
    ],
  },
]

export const memberNav: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
      { label: 'My Courses', href: '/courses', icon: BookOpen },
      { label: 'Announcements', href: '/announcements', icon: Bell },
    ],
  },
  {
    label: 'Internal',
    // TEAM-only entries — MEMBER (LMS students) never see any of
    // this. Each is per-user gated via moduleKey so a TEAM user
    // sees exactly the modules their grants unlock. Every route
    // lives under /team/* — the admin surface at /admin/* is
    // reserved for ADMIN only.
    items: [
      { label: 'Team', href: '/team', icon: Users, visibleTo: ['TEAM'], moduleKey: 'team' },
      { label: 'Task Tracker', href: '/team/tasks', icon: CheckSquare, visibleTo: ['TEAM'], moduleKey: 'tasks' },
      { label: 'Policies', href: '/team/policies', icon: BookText, visibleTo: ['TEAM'], moduleKey: 'policies' },
      { label: 'Trainings', href: '/team/trainings', icon: GraduationCap, visibleTo: ['TEAM'], moduleKey: 'trainings' },
      { label: 'Statistics', href: '/team/stats', icon: BarChart3, visibleTo: ['TEAM'], moduleKey: 'stats' },
      { label: 'Organization Board', href: '/team/org-board', icon: Network, visibleTo: ['TEAM'], moduleKey: 'org-board' },
      { label: 'Onboarding', href: '/team/onboarding', icon: UserPlus, visibleTo: ['TEAM'], moduleKey: 'onboarding' },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Certificates', href: '/certificates', icon: Award },
      { label: 'Profile', href: '/profile', icon: User },
    ],
  },
]

/**
 * Filter a nav config down to items visible to the given role +
 * (for TEAM users) the per-user module grants. Sections that
 * become empty after filtering are dropped so the sidebar doesn't
 * render bare section labels.
 *
 * grantedModules is only consulted when role === 'TEAM'. ADMIN
 * sees every moduleKey-gated item regardless (they always have
 * full access by design). Pass an empty Set for TEAM with no
 * grants; the caller can pass `null` to opt out of the check
 * entirely (used pre-hydration / SSR where grants aren't loaded
 * yet).
 */
export function filterNavForRole(
  sections: NavSection[],
  role: NavRole,
  grantedModules: Set<string> | null = null,
): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.visibleTo && !item.visibleTo.includes(role)) return false
        // Per-user gate only applies to TEAM. ADMIN + MEMBER paths
        // (MEMBER never sees moduleKey items anyway via visibleTo)
        // skip the grant check.
        if (item.moduleKey && role === 'TEAM') {
          if (grantedModules === null) return false
          if (!grantedModules.has(item.moduleKey)) return false
        }
        return true
      }),
    }))
    .filter((section) => section.items.length > 0)
}

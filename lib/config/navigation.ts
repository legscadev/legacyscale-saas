import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
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

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  /** Match the href exactly (used for section roots like /admin). */
  exact?: boolean
  badge?: string
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
    items: [
      { label: 'Team', href: '/admin/team', icon: Users },
      // Tasks tracker hidden from the sidebar for now — the route
      // at /admin/tasks stays live, so admins with a direct link
      // can still open it. Re-add this entry when the feature is
      // ready to surface across all tenants.
      // { label: 'Tasks', href: '/admin/tasks', icon: CheckSquare },
      { label: 'Trainings', href: '/admin/trainings', icon: GraduationCap },
      { label: 'Statistics', href: '/admin/stats', icon: BarChart3 },
      { label: 'Organization Board', href: '/admin/org-board', icon: Network },
      { label: 'Onboarding', href: '/admin/onboarding', icon: UserPlus },
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
    label: 'Account',
    items: [
      { label: 'Certificates', href: '/certificates', icon: Award },
      { label: 'Profile', href: '/profile', icon: User },
    ],
  },
]

import {
  Bell,
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  type LucideIcon,
  Megaphone,
  Settings,
  User,
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
    label: 'Content',
    items: [
      { label: 'Courses', href: '/admin/courses', icon: GraduationCap },
      { label: 'Announcements', href: '/admin/announcements', icon: Megaphone },
    ],
  },
  {
    label: 'People',
    items: [{ label: 'Members', href: '/admin/members', icon: Users }],
  },
  {
    label: 'System',
    items: [{ label: 'Settings', href: '/admin/settings', icon: Settings }],
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
    items: [{ label: 'Profile', href: '/profile', icon: User }],
  },
]

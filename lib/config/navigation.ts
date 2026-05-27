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
}

export const adminNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Members', href: '/admin/members', icon: Users },
  { label: 'Courses', href: '/admin/courses', icon: GraduationCap },
  { label: 'Announcements', href: '/admin/announcements', icon: Megaphone },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
]

export const userNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Courses', href: '/courses', icon: BookOpen },
  { label: 'Announcements', href: '/announcements', icon: Bell },
  { label: 'Profile', href: '/profile', icon: User },
]

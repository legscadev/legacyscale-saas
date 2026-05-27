import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  LifeBuoy,
  type LucideIcon,
  Megaphone,
  Rocket,
  Settings,
  Ticket,
  Users,
} from "lucide-react"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  badge?: string
  soon?: boolean
}

export interface NavSection {
  label?: string
  items: NavItem[]
}

const ADMIN = "/prototype/admin"

export const adminNav: NavSection[] = [
  {
    items: [
      { label: "Overview", href: `${ADMIN}/dashboard`, icon: LayoutDashboard },
      { label: "Analytics", href: `${ADMIN}/analytics`, icon: BarChart3 },
    ],
  },
  {
    label: "Content",
    items: [
      { label: "Courses", href: `${ADMIN}/courses`, icon: GraduationCap },
      {
        label: "Announcements",
        href: `${ADMIN}/announcements`,
        icon: Megaphone,
      },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Members", href: `${ADMIN}/members`, icon: Users },
      { label: "Enrollments", href: `${ADMIN}/enrollments`, icon: Ticket },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Settings", href: `${ADMIN}/settings`, icon: Settings },
      { label: "Phase 2 Roadmap", href: `${ADMIN}/roadmap`, icon: Rocket },
    ],
  },
]

const MEMBER = "/prototype/member"

export const memberNav: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: `${MEMBER}/dashboard`, icon: LayoutDashboard },
      { label: "My Courses", href: `${MEMBER}/courses`, icon: BookOpen },
      {
        label: "Notifications",
        href: `${MEMBER}/notifications`,
        icon: Bell,
        badge: "2",
      },
      { label: "Activity", href: `${MEMBER}/activity`, icon: Activity },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Settings", href: `${MEMBER}/account`, icon: Settings },
      { label: "Help & Support", href: `${MEMBER}/help`, icon: LifeBuoy },
    ],
  },
]

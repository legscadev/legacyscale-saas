import Link from 'next/link'
import { Logo } from './logo'
import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/auth/actions'
import type { NavItem } from '@/lib/config/navigation'

interface TopNavProps {
  navItems: NavItem[]
  user: { name: string | null; email: string }
}

// Minimal top navigation used by the admin/user shells. The richer
// sidebar navigation is added in task 0.9.
export function TopNav({ navItems, user }: TopNavProps) {
  return (
    <header className="flex h-14 items-center gap-4 border-b px-4 md:px-6">
      <Logo />

      <nav className="hidden items-center gap-1 md:flex">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {user.name ?? user.email}
        </span>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  )
}

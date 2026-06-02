'use client'

import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from './theme-toggle'
import { UserMenu, type ShellUser } from './user-menu'

interface TopBarProps {
  onMenuClick: () => void
  user: ShellUser
  profileHref: string
}

export function TopBar({
  onMenuClick,
  user,
  profileHref,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur sm:px-4">
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <Menu />
      </Button>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <UserMenu user={user} profileHref={profileHref} variant="topbar" />
      </div>
    </header>
  )
}

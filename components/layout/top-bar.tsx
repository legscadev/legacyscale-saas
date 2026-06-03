'use client'

import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useSidebar } from './sidebar-context'
import { ThemeToggle } from './theme-toggle'
import { UserMenu, type ShellUser } from './user-menu'

interface TopBarProps {
  onMenuClick: () => void
  user: ShellUser
  profileHref: string
}

export function TopBar({ onMenuClick, user, profileHref }: TopBarProps) {
  const { collapsed, toggle } = useSidebar()
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose
  const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar'

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur sm:px-4">
      {/* Mobile: open drawer */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <Menu />
      </Button>

      {/* Desktop: collapse / expand */}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="hidden lg:inline-flex"
              onClick={toggle}
              aria-label={label}
              aria-expanded={!collapsed}
            >
              <Icon />
            </Button>
          }
        />
        <TooltipContent side="bottom">
          {label}
          <span className="ml-2 text-muted-foreground">⌘B</span>
        </TooltipContent>
      </Tooltip>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <UserMenu user={user} profileHref={profileHref} variant="topbar" />
      </div>
    </header>
  )
}

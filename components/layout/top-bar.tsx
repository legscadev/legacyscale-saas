'use client'

import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from './theme-toggle'

interface TopBarProps {
  onMenuClick: () => void
}

export function TopBar({ onMenuClick }: TopBarProps) {
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

      <div className="ml-auto flex items-center gap-0.5">
        <ThemeToggle />
      </div>
    </header>
  )
}

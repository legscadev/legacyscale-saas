'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, HelpCircle, Menu, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useSidebar } from './sidebar-context'
import { ThemeToggle } from './theme-toggle'
import { UserMenu, type ShellUser } from './user-menu'
import { CommandPalette } from './command-palette'
import { ShortcutsModal } from './shortcuts-modal'

interface TopBarProps {
  onMenuClick: () => void
  user: ShellUser
  profileHref: string
  role: 'admin' | 'member'
}

export function TopBar({ onMenuClick, user, profileHref, role }: TopBarProps) {
  const { collapsed, toggle } = useSidebar()
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose
  const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar'

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  // Global keyboard shortcuts. Mounted once at the TopBar level so
  // they work regardless of which page is rendered.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K → command palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }
      // ? → shortcuts modal (ignore while typing in form fields).
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement | null
        const tag = target?.tagName
        const editable =
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target?.isContentEditable
        if (editable) return
        e.preventDefault()
        setShortcutsOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur-md sm:px-4">
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

        {/* Search trigger — looks like an input, opens the command palette. */}
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label="Search (⌘K)"
          className={cn(
            'group/search ml-1 hidden h-9 items-center gap-2.5 rounded-lg border border-input bg-card px-3 text-sm text-muted-foreground shadow-xs transition-all',
            'hover:border-input/80 hover:text-foreground hover:bg-muted/40',
            'focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:outline-none',
            'sm:flex sm:min-w-64 md:min-w-80',
          )}
        >
          <Search className="size-4 shrink-0" />
          <span className="flex-1 truncate text-left">Search or jump to…</span>
          <kbd className="hidden h-5 items-center gap-0.5 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground sm:flex">
            ⌘K
          </kbd>
        </button>

        {/* Mobile search button — icon only. */}
        <Button
          variant="ghost"
          size="icon-sm"
          className="sm:hidden"
          onClick={() => setPaletteOpen(true)}
          aria-label="Search"
        >
          <Search />
        </Button>

        <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Help"
                  onClick={() => setShortcutsOpen(true)}
                  className="hidden sm:inline-flex"
                >
                  <HelpCircle />
                </Button>
              }
            />
            <TooltipContent side="bottom">
              Keyboard shortcuts
              <span className="ml-2 text-muted-foreground">?</span>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Announcements"
                  className="relative"
                  render={
                    <Link
                      href={role === 'admin' ? '/admin/announcements' : '/announcements'}
                    />
                  }
                >
                  <Bell />
                </Button>
              }
            />
            <TooltipContent side="bottom">Announcements</TooltipContent>
          </Tooltip>

          <ThemeToggle />
          <div className="ml-1 lg:hidden">
            <UserMenu user={user} profileHref={profileHref} variant="topbar" />
          </div>
        </div>
      </header>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        role={role}
      />
      <ShortcutsModal open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </>
  )
}

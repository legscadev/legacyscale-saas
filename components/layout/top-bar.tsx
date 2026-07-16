'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeftRight,
  Bell,
  HelpCircle,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
} from 'lucide-react'

import { TaskNotificationsBell } from '@/components/admin/tasks/task-notifications-bell'
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
  role: 'admin' | 'member' | 'super'
  /** Number of published announcements the current user hasn't
   *  opened yet. Rendered as a numeric pill on the Bell when > 0. */
  unreadAnnouncements?: number
  /** When true and role='admin', the top bar shows a "Super Admin"
   *  shortcut that jumps to /super. Members never see it, and it's
   *  redundant when the caller is already inside /super. */
  isSuperAdmin?: boolean
  /** Disable the light/dark toggle because a tenant palette owns
   *  the theme. */
  themeLocked?: boolean
}

export function TopBar({
  onMenuClick,
  user,
  profileHref,
  role,
  isSuperAdmin = false,
  unreadAnnouncements = 0,
  themeLocked = false,
}: TopBarProps) {
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
          {/* Super-admin shortcut — visible in /admin/* only when
              the caller carries the master key. Renders as a small
              red pill so it doesn't blend into the regular topbar
              chrome; matches the "you're wearing your other hat"
              posture of the View-as-member button beside it. */}
          {role === 'admin' && isSuperAdmin ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label="Open super-admin console"
                    className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
                    render={<Link href="/super" />}
                  >
                    <ShieldCheck className="size-4" />
                    <span className="hidden sm:inline">Super Admin</span>
                  </Button>
                }
              />
              <TooltipContent side="bottom">
                Jump to the platform-owner console
              </TooltipContent>
            </Tooltip>
          ) : null}

          {/* Role swap. Admins can jump from the admin shell into
              their own member experience (and back) so they can see
              courses/announcements the way a member does without
              signing out or spinning up a second account. Only
              rendered when the swap is meaningful — TEAM users get
              it on admin pages too, since they see admin routes. */}
          {(user.role === 'ADMIN' || user.role === 'TEAM') ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={
                      role === 'admin'
                        ? 'View as member'
                        : 'Back to admin view'
                    }
                    render={
                      <Link
                        href={role === 'admin' ? '/dashboard' : '/admin/dashboard'}
                      />
                    }
                  >
                    <ArrowLeftRight className="size-4" />
                    <span className="hidden sm:inline">
                      {role === 'admin' ? 'View as member' : 'Back to admin'}
                    </span>
                  </Button>
                }
              />
              <TooltipContent side="bottom">
                {role === 'admin'
                  ? 'Open the app the way a member sees it'
                  : 'Return to the admin surface'}
              </TooltipContent>
            </Tooltip>
          ) : null}

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
                  aria-label={
                    unreadAnnouncements > 0
                      ? `Announcements (${unreadAnnouncements} unread)`
                      : 'Announcements'
                  }
                  className="relative"
                  render={
                    <Link
                      href={role === 'admin' ? '/admin/announcements' : '/announcements'}
                    />
                  }
                >
                  <Bell />
                  {unreadAnnouncements > 0 ? (
                    <span
                      aria-hidden="true"
                      className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground tabular-nums ring-2 ring-background"
                    >
                      {unreadAnnouncements > 9 ? '9+' : unreadAnnouncements}
                    </span>
                  ) : null}
                </Button>
              }
            />
            <TooltipContent side="bottom">
              {unreadAnnouncements > 0
                ? `Announcements · ${unreadAnnouncements} unread`
                : 'Announcements'}
            </TooltipContent>
          </Tooltip>

          {role === 'admin' ? <TaskNotificationsBell /> : null}

          <ThemeToggle locked={themeLocked} />
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

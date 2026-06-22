'use client'

import { useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { adminNav, memberNav } from '@/lib/config/navigation'
import { BrandMark } from './brand-mark'
import { SidebarNav } from './sidebar-nav'
import { SidebarProvider, useSidebar } from './sidebar-context'
import { TopBar } from './top-bar'
import { UserMenu, type ShellUser } from './user-menu'

interface AppShellProps {
  role: 'admin' | 'member'
  user: ShellUser
  /** Server-rendered initial collapsed state from cookie. */
  defaultCollapsed?: boolean
  /** Count of published announcements the current user hasn't
   *  opened — surfaces as a numeric pill on the Bell. */
  unreadAnnouncements?: number
  children: React.ReactNode
}

export function AppShell({
  role,
  user,
  defaultCollapsed = false,
  unreadAnnouncements = 0,
  children,
}: AppShellProps) {
  return (
    <SidebarProvider defaultCollapsed={defaultCollapsed}>
      <AppShellInner
        role={role}
        user={user}
        unreadAnnouncements={unreadAnnouncements}
      >
        {children}
      </AppShellInner>
    </SidebarProvider>
  )
}

function AppShellInner({
  role,
  user,
  unreadAnnouncements = 0,
  children,
}: Omit<AppShellProps, 'defaultCollapsed'>) {
  const { collapsed } = useSidebar()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const isAdmin = role === 'admin'
  const sections = isAdmin ? adminNav : memberNav
  const context = isAdmin ? 'Admin Console' : 'Member'
  const homeHref = isAdmin ? '/admin/dashboard' : '/dashboard'
  const profileHref = isAdmin ? '/admin/profile' : '/profile'

  return (
    <div
      className="min-h-screen bg-background"
      data-state={collapsed ? 'collapsed' : 'expanded'}
    >
      {/* Desktop sidebar — always dark (Vercel pattern). */}
      <aside
        data-sidebar="dark"
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden flex-col bg-neutral-950 text-neutral-300 transition-[width] duration-200 ease-in-out lg:flex',
          collapsed ? 'w-14' : 'w-64',
        )}
      >
        <div
          className={cn(
            'flex h-14 items-center',
            collapsed ? 'justify-center px-2' : 'px-4',
          )}
        >
          <Link
            href={homeHref}
            className="flex items-center text-white"
            aria-label={context}
          >
            <BrandMark context={context} compact={collapsed} />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-3">
          <SidebarNav sections={sections} collapsed={collapsed} />
        </div>
        {/* Sidebar user mini-card — collapses to avatar-only when the
            sidebar is collapsed. Sits flush at the bottom for the
            classic Notion / Linear / Vercel pattern. */}
        <div
          className={cn(
            collapsed ? 'flex justify-center p-2' : 'p-2',
          )}
        >
          <UserMenu
            user={user}
            profileHref={profileHref}
            variant={collapsed ? 'topbar' : 'sidebar'}
          />
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            data-sidebar="dark"
            className="absolute inset-y-0 left-0 flex w-72 flex-col bg-neutral-950 text-neutral-300 animate-in slide-in-from-left"
          >
            <div className="flex h-14 items-center justify-between px-4">
              <span className="text-white">
                <BrandMark context={context} />
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation"
                className="text-neutral-300 hover:bg-white/10 hover:text-white"
              >
                <X />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto py-3">
              <SidebarNav
                sections={sections}
                onNavigate={() => setDrawerOpen(false)}
              />
            </div>
            <div className="p-2">
              <UserMenu
                user={user}
                profileHref={profileHref}
                variant="sidebar"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main column */}
      <div
        className={cn(
          'flex min-h-screen flex-col transition-[padding] duration-200 ease-in-out',
          collapsed ? 'lg:pl-14' : 'lg:pl-64',
        )}
      >
        <TopBar
          onMenuClick={() => setDrawerOpen(true)}
          user={user}
          profileHref={profileHref}
          role={role}
          unreadAnnouncements={unreadAnnouncements}
        />
        <main className="flex-1">
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}

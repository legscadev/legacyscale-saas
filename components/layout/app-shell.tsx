'use client'

import { useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { adminNav, memberNav } from '@/lib/config/navigation'
import { BrandMark } from './brand-mark'
import { SidebarNav } from './sidebar-nav'
import { TopBar } from './top-bar'
import { type ShellUser } from './user-menu'

interface AppShellProps {
  role: 'admin' | 'member'
  user: ShellUser
  children: React.ReactNode
}

export function AppShell({ role, user, children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  const isAdmin = role === 'admin'
  const sections = isAdmin ? adminNav : memberNav
  const context = isAdmin ? 'Admin Console' : 'Member'
  const homeHref = isAdmin ? '/admin/dashboard' : '/dashboard'
  const profileHref = isAdmin ? '/admin/profile' : '/profile'
  const settingsHref = isAdmin ? '/admin/settings' : '/profile'

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-card/30 lg:flex">
        <div className="flex h-14 items-center border-b px-4">
          <Link href={homeHref}>
            <BrandMark context={context} />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto py-3">
          <SidebarNav sections={sections} />
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
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col border-r bg-card animate-in slide-in-from-left">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <BrandMark context={context} />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation"
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
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-h-screen flex-col lg:pl-64">
        <TopBar
          onMenuClick={() => setDrawerOpen(true)}
          user={user}
          profileHref={profileHref}
          settingsHref={settingsHref}
        />
        <main className="flex-1">
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}

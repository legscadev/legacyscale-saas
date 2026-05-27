"use client"

import { useState } from "react"
import Link from "next/link"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { currentAdmin, currentMember } from "@/lib/prototype"
import { BrandMark } from "./brand-mark"
import { CommandPalette } from "./command-palette"
import { adminNav, memberNav } from "./nav-config"
import { SidebarNav } from "./sidebar-nav"
import { TopBar } from "./top-bar"
import { UserMenu } from "./user-menu"

interface AppShellProps {
  role: "admin" | "member"
  children: React.ReactNode
}

export function AppShell({ role, children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  const isAdmin = role === "admin"
  const sections = isAdmin ? adminNav : memberNav
  const user = isAdmin ? currentAdmin : currentMember
  const settingsHref = isAdmin
    ? "/prototype/admin/settings"
    : "/prototype/member/account"
  const notificationsHref = isAdmin
    ? undefined
    : "/prototype/member/notifications"

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-card/30 lg:flex">
        <div className="flex h-14 items-center border-b px-4">
          <Link href={`/prototype/${role}/dashboard`}>
            <BrandMark context={isAdmin ? "Admin Console" : "Member"} />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto py-3 scrollbar-thin">
          <SidebarNav sections={sections} />
        </div>
        <div className="border-t p-2">
          <UserMenu user={user} settingsHref={settingsHref} />
        </div>
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col border-r bg-card animate-in slide-in-from-left">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <BrandMark context={isAdmin ? "Admin Console" : "Member"} />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setDrawerOpen(false)}
              >
                <X />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto py-3 scrollbar-thin">
              <SidebarNav
                sections={sections}
                onNavigate={() => setDrawerOpen(false)}
              />
            </div>
            <div className="border-t p-2">
              <UserMenu user={user} settingsHref={settingsHref} />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-screen flex-col lg:pl-64">
        <TopBar
          onMenuClick={() => setDrawerOpen(true)}
          notificationsHref={notificationsHref}
          notificationCount={isAdmin ? 0 : 2}
        />
        <main className="flex-1">{children}</main>
      </div>

      <CommandPalette />
    </div>
  )
}

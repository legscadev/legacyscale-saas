"use client"

import { useState } from "react"
import Link from "next/link"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  SidebarProvider,
  useSidebar,
} from "@/components/layout/sidebar-context"
import { currentAdmin, currentMember } from "@/lib/prototype"
import { BrandMark } from "./brand-mark"
import { CommandPalette } from "./command-palette"
import { adminNav, memberNav } from "./nav-config"
import { SidebarNav } from "./sidebar-nav"
import { TopBar } from "./top-bar"

interface AppShellProps {
  role: "admin" | "member"
  /** Server-rendered initial collapsed state from cookie. */
  defaultCollapsed?: boolean
  children: React.ReactNode
}

export function AppShell({
  role,
  defaultCollapsed = false,
  children,
}: AppShellProps) {
  return (
    <SidebarProvider defaultCollapsed={defaultCollapsed}>
      <AppShellInner role={role}>{children}</AppShellInner>
    </SidebarProvider>
  )
}

function AppShellInner({ role, children }: Omit<AppShellProps, "defaultCollapsed">) {
  const { collapsed } = useSidebar()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const isAdmin = role === "admin"
  const sections = isAdmin ? adminNav : memberNav
  const user = isAdmin ? currentAdmin : currentMember
  const context = isAdmin ? "Admin Console" : "Member"
  const homeHref = `/prototype/${role}/dashboard`
  const settingsHref = isAdmin
    ? "/prototype/admin/settings"
    : "/prototype/member/account"
  const notificationsHref = isAdmin
    ? undefined
    : "/prototype/member/notifications"

  return (
    <div
      className="min-h-screen bg-background"
      data-state={collapsed ? "collapsed" : "expanded"}
    >
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r bg-card/30 transition-[width] duration-200 ease-in-out lg:flex",
          collapsed ? "w-14" : "w-64",
        )}
      >
        <div
          className={cn(
            "flex h-14 items-center border-b",
            collapsed ? "justify-center px-2" : "px-4",
          )}
        >
          <Link href={homeHref} aria-label={context}>
            <BrandMark context={context} compact={collapsed} />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 scrollbar-thin">
          <SidebarNav sections={sections} collapsed={collapsed} />
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
              <BrandMark context={context} />
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
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "flex min-h-screen flex-col transition-[padding] duration-200 ease-in-out",
          collapsed ? "lg:pl-14" : "lg:pl-64",
        )}
      >
        <TopBar
          onMenuClick={() => setDrawerOpen(true)}
          user={user}
          settingsHref={settingsHref}
          notificationsHref={notificationsHref}
          notificationCount={isAdmin ? 0 : 2}
        />
        <main className="flex-1">{children}</main>
      </div>

      <CommandPalette />
    </div>
  )
}

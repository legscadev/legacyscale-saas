"use client"

import Link from "next/link"
import { Bell, Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useSidebar } from "@/components/layout/sidebar-context"
import type { User } from "@/lib/prototype"
import { ThemeToggle } from "./theme-toggle"
import { UserMenu } from "./user-menu"

interface TopBarProps {
  onMenuClick: () => void
  user: User
  settingsHref: string
  notificationsHref?: string
  notificationCount?: number
}

export function TopBar({
  onMenuClick,
  user,
  settingsHref,
  notificationsHref,
  notificationCount,
}: TopBarProps) {
  const { collapsed, toggle } = useSidebar()
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose
  const collapseLabel = collapsed ? "Expand sidebar" : "Collapse sidebar"

  const openPalette = () =>
    window.dispatchEvent(new CustomEvent("open-command-palette"))

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur supports-backdrop-filter:bg-background/60 sm:px-4">
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
              aria-label={collapseLabel}
              aria-expanded={!collapsed}
            >
              <Icon />
            </Button>
          }
        />
        <TooltipContent side="bottom">
          {collapseLabel}
          <span className="ml-2 text-muted-foreground">⌘B</span>
        </TooltipContent>
      </Tooltip>

      <button
        onClick={openPalette}
        className="flex h-8 w-full max-w-72 items-center gap-2 rounded-lg border bg-muted/40 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="hidden rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium sm:inline">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-0.5">
        <ThemeToggle />
        {notificationsHref ? (
          <Button
            variant="ghost"
            size="icon-sm"
            render={<Link href={notificationsHref} />}
            aria-label="Notifications"
            className="relative"
          >
            <Bell />
            {notificationCount ? (
              <span className="absolute top-1 right-1 flex size-1.5 rounded-full bg-primary" />
            ) : null}
          </Button>
        ) : null}
        <UserMenu user={user} settingsHref={settingsHref} compact />
      </div>
    </header>
  )
}

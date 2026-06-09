"use client"

import Link from "next/link"
import { ChevronsUpDown, LogOut, Settings, UserRound } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { initials } from "@/lib/prototype"
import type { User } from "@/lib/prototype"

interface UserMenuProps {
  user: User
  /** Where the in-app settings link should point. */
  settingsHref: string
  /** Avatar-only variant — used by the collapsed sidebar. */
  compact?: boolean
}

export function UserMenu({ user, settingsHref, compact = false }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            aria-label={compact ? user.name : undefined}
            className={
              compact
                ? "grid w-full place-items-center rounded-lg p-1 transition-colors hover:bg-muted/60"
                : "flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-muted/60"
            }
          />
        }
      >
        <Avatar size="sm">
          {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
          <AvatarFallback>{initials(user.name)}</AvatarFallback>
        </Avatar>
        {!compact ? (
          <>
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-sm font-medium">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            </div>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            {user.role === "ADMIN" ? "Administrator" : "Member"}
          </DropdownMenuLabel>
          <DropdownMenuItem render={<Link href={settingsHref} />}>
            <UserRound />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href={settingsHref} />}>
            <Settings />
            Settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          render={<Link href="/prototype/auth/sign-in" />}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

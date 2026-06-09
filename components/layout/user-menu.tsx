'use client'

import Link from 'next/link'
import { ChevronsUpDown, LogOut, UserRound } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { signOut } from '@/lib/auth/actions'

export interface ShellUser {
  name: string | null
  email: string
  avatarUrl: string | null
  role: 'ADMIN' | 'MEMBER'
}

interface UserMenuProps {
  user: ShellUser
  profileHref: string
  /** "sidebar" = full-width row, "topbar" = avatar-only button. */
  variant?: 'sidebar' | 'topbar'
}

function getInitials(name: string | null, email: string): string {
  const source = name?.trim() || email
  const parts = source.split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  }
  return source.slice(0, 2).toUpperCase()
}

export function UserMenu({
  user,
  profileHref,
  variant = 'sidebar',
}: UserMenuProps) {
  const initials = getInitials(user.name, user.email)
  const displayName = user.name ?? user.email
  const compact = variant === 'topbar'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            className={cn(
              'text-left transition-colors',
              compact
                ? 'rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:opacity-90'
                : 'flex w-full items-center gap-2.5 rounded-lg p-1.5 text-neutral-200 hover:bg-white/[0.06]',
            )}
            aria-label={compact ? `Account menu — ${displayName}` : undefined}
          />
        }
      >
        {compact ? (
          <Avatar>
            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        ) : (
          <>
            <Avatar size="sm">
              {user.avatarUrl ? (
                <AvatarImage src={user.avatarUrl} alt="" />
              ) : null}
              <AvatarFallback className="bg-neutral-800 text-neutral-100">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-sm font-medium text-white">
                {displayName}
              </span>
              <span className="truncate text-xs text-neutral-400">
                {user.email}
              </span>
            </div>
            <ChevronsUpDown className="size-4 shrink-0 text-neutral-500" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {/* Always show the identity card at the top — useful in compact
            mode (no name in the trigger) and unobtrusive in sidebar mode. */}
        <div className="flex items-center gap-2.5 px-2 py-2">
          <Avatar size="sm">
            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-sm font-medium">{displayName}</span>
            <span className="truncate text-xs text-muted-foreground">
              {user.email}
            </span>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            {user.role === 'ADMIN' ? 'Administrator' : 'Member'}
          </DropdownMenuLabel>
          <DropdownMenuItem render={<Link href={profileHref} />}>
            <UserRound />
            Profile
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <form action={signOut} className="p-1">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive outline-none transition-colors hover:bg-destructive/10"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

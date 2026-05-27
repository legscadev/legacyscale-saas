'use client'

import Link from 'next/link'
import { ChevronsUpDown, LogOut, Settings, UserRound } from 'lucide-react'
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
import { signOut } from '@/lib/auth/actions'

export interface ShellUser {
  name: string | null
  email: string
  avatarUrl: string | null
  role: 'ADMIN' | 'MEMBER'
}

interface UserMenuProps {
  user: ShellUser
  settingsHref: string
}

function getInitials(name: string | null, email: string): string {
  const source = name?.trim() || email
  const parts = source.split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  }
  return source.slice(0, 2).toUpperCase()
}

export function UserMenu({ user, settingsHref }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-muted/60" />
        }
      >
        <Avatar size="sm">
          {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
          <AvatarFallback>{getInitials(user.name, user.email)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-sm font-medium">
            {user.name ?? user.email}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {user.email}
          </span>
        </div>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            {user.role === 'ADMIN' ? 'Administrator' : 'Member'}
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

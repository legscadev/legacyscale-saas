'use client'

import { MoreHorizontal } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface MemberActionsMenuProps {
  memberId: string
  isActive: boolean
  isSelf: boolean
}

/**
 * Per-row actions menu. Items are stubbed until the next two tickets
 * land — 1.11 (edit) and 1.12 (activate/deactivate).
 */
export function MemberActionsMenu({
  isActive,
  isSelf,
}: MemberActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Open actions"
          />
        }
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem disabled>Edit details</DropdownMenuItem>
        <DropdownMenuSeparator />
        {isSelf ? (
          <DropdownMenuItem disabled>You</DropdownMenuItem>
        ) : isActive ? (
          <DropdownMenuItem disabled className="text-destructive">
            Deactivate
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled>Reactivate</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

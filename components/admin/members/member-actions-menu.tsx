'use client'

import {
  Archive,
  Edit3,
  KeyRound,
  Mail,
  MoreHorizontal,
  ShieldCheck,
  UserX,
} from 'lucide-react'

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
 * Per-row actions menu. Items are stubbed until the related tickets
 * land — 1.11 (edit / create), 1.12 (suspend / reactivate),
 * 1.13 (archive).
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
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem disabled>
          <Edit3 />
          Edit details
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <KeyRound />
          Send password reset
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Mail />
          Resend welcome email
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {isSelf ? (
          <DropdownMenuItem disabled>You</DropdownMenuItem>
        ) : (
          <>
            {isActive ? (
              <DropdownMenuItem disabled className="text-destructive">
                <UserX />
                Suspend access
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem disabled>
                <ShieldCheck />
                Reactivate
              </DropdownMenuItem>
            )}
            <DropdownMenuItem disabled className="text-destructive">
              <Archive />
              Archive
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

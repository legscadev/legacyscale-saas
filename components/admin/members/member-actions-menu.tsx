'use client'

import { useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  Bell,
  Edit3,
  KeySquare,
  Mail,
  MoreHorizontal,
  ShieldCheck,
  UserX,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AccessGridDialog } from '@/components/admin/team/access-grid-dialog'

import { MemberEditDialog } from './member-edit-dialog'
import { NudgeDialog } from './nudge-dialog'
import type { MemberCategoryOption } from './members-shell'

interface MemberActionsMenuProps {
  memberId: string
  memberName: string
  memberEmail: string
  memberRole: 'ADMIN' | 'TEAM' | 'MEMBER'
  memberCategoryId: string | null
  categories: MemberCategoryOption[]
  isActive: boolean
  isArchived: boolean
  isSelf: boolean
  onRefetch: () => void
  /** Restrict the edit dialog's role picker. Falls through from
   *  the page-level lens (Members = MEMBER only, Team = ADMIN+TEAM). */
  allowedRoles?: ('ADMIN' | 'TEAM' | 'MEMBER')[]
}

export function MemberActionsMenu({
  memberId,
  memberName,
  memberEmail,
  memberRole,
  memberCategoryId,
  categories,
  isActive,
  isArchived,
  isSelf,
  onRefetch,
  allowedRoles,
}: MemberActionsMenuProps) {
  const [confirmingSuspend, setConfirmingSuspend] = useState(false)
  const [confirmingArchive, setConfirmingArchive] = useState(false)
  const [editing, setEditing] = useState(false)
  const [nudging, setNudging] = useState(false)
  const [managingAccess, setManagingAccess] = useState(false)
  const [pending, setPending] = useState(false)
  const [resending, setResending] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [restoring, setRestoring] = useState(false)

  const resendInvite = async () => {
    setResending(true)
    try {
      const res = await fetch(`/api/admin/members/${memberId}/resend-invite`, {
        method: 'POST',
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? 'Could not resend invite')
        return
      }
      toast.success(`Welcome email resent to ${json.data.email}`, {
        description: 'They have 7 days to set their password.',
      })
    } catch (err) {
      console.error(err)
      toast.error('Network error — please try again')
    } finally {
      setResending(false)
    }
  }

  const restore = async () => {
    setRestoring(true)
    try {
      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archive: false }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? 'Could not restore member')
        return
      }
      toast.success(`${memberName} restored`, {
        description: 'They&apos;re back on the active roster.',
      })
      onRefetch()
    } catch (err) {
      console.error(err)
      toast.error('Network error — please try again')
    } finally {
      setRestoring(false)
    }
  }

  const archive = async () => {
    setArchiving(true)
    try {
      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archive: true }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? 'Could not archive member')
        return
      }
      toast.success(`${memberName} archived`, {
        description: 'They no longer appear in the active roster.',
      })
      onRefetch()
    } catch (err) {
      console.error(err)
      toast.error('Network error — please try again')
    } finally {
      setArchiving(false)
      setConfirmingArchive(false)
    }
  }

  const setActive = async (nextIsActive: boolean) => {
    setPending(true)
    try {
      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextIsActive }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? 'Could not update access')
        return
      }
      toast.success(
        nextIsActive
          ? `${memberName} can sign in again`
          : `${memberName}'s access is paused`,
      )
      onRefetch()
    } catch (err) {
      console.error(err)
      toast.error('Network error — please try again')
    } finally {
      setPending(false)
      setConfirmingSuspend(false)
    }
  }

  return (
    <>
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
          {isArchived ? (
            <DropdownMenuItem onClick={restore} disabled={restoring}>
              <ArchiveRestore />
              Restore member
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem onClick={() => setEditing(true)}>
                <Edit3 />
                Edit details
              </DropdownMenuItem>
              {!isSelf && (
                <DropdownMenuItem
                  onClick={resendInvite}
                  disabled={resending}
                >
                  <Mail />
                  Resend welcome email
                </DropdownMenuItem>
              )}
              {!isSelf && isActive && (
                <DropdownMenuItem onClick={() => setNudging(true)}>
                  <Bell />
                  Send nudge
                </DropdownMenuItem>
              )}
              {/* Per-user Internal-module grants only apply to
                  TEAM. ADMIN always has full access and MEMBER
                  holds no grants. */}
              {memberRole === 'TEAM' && !isArchived && (
                <DropdownMenuItem onClick={() => setManagingAccess(true)}>
                  <KeySquare />
                  Manage access
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {isSelf ? (
                <DropdownMenuItem disabled>You</DropdownMenuItem>
              ) : (
                <>
                  {isActive ? (
                    <DropdownMenuItem
                      onClick={() => setConfirmingSuspend(true)}
                      className="text-destructive"
                    >
                      <UserX />
                      Suspend access
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={() => setActive(true)}
                      disabled={pending}
                    >
                      <ShieldCheck />
                      Reactivate
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => setConfirmingArchive(true)}
                    className="text-destructive"
                  >
                    <Archive />
                    Archive
                  </DropdownMenuItem>
                </>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={confirmingSuspend}
        onOpenChange={setConfirmingSuspend}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend {memberName}?</AlertDialogTitle>
            <AlertDialogDescription>
              They&apos;ll be signed out on their next page load and won&apos;t
              be able to sign back in until you reactivate them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                setActive(false)
              }}
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pending ? 'Suspending…' : 'Suspend access'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmingArchive}
        onOpenChange={setConfirmingArchive}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {memberName}?</AlertDialogTitle>
            <AlertDialogDescription>
              They&apos;ll be removed from the active roster and lose
              access immediately. Their history is preserved and can be
              restored later from the Archived view.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                archive()
              }}
              disabled={archiving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {archiving ? 'Archiving…' : 'Archive member'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MemberEditDialog
        open={editing}
        onOpenChange={setEditing}
        member={{
          id: memberId,
          name: memberName,
          email: memberEmail,
          role: memberRole,
          categoryId: memberCategoryId,
        }}
        categories={categories}
        canChangeRole={!isSelf}
        onSaved={onRefetch}
        allowedRoles={allowedRoles}
      />

      <NudgeDialog
        open={nudging}
        onOpenChange={setNudging}
        memberId={memberId}
        memberName={memberName}
      />

      <AccessGridDialog
        open={managingAccess}
        onOpenChange={setManagingAccess}
        target={
          managingAccess
            ? { id: memberId, name: memberName, email: memberEmail }
            : null
        }
      />
    </>
  )
}

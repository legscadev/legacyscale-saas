'use client'

import { useEffect, useMemo, useState } from 'react'
import { Archive, Download, ShieldCheck, UserX, X } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { MemberListItem } from '@/lib/services/member-service'

type Role = 'ADMIN' | 'MEMBER'
type StatusChoice = 'active' | 'suspended'

interface BulkActionBarProps {
  selectedIds: string[]
  members: MemberListItem[]
  currentUserId: string
  onClear: () => void
  onRefetch: () => void
}

export function BulkActionBar({
  selectedIds,
  members,
  currentUserId,
  onClear,
  onRefetch,
}: BulkActionBarProps) {
  const [dialog, setDialog] = useState<
    'role' | 'status' | 'archive' | null
  >(null)
  const [role, setRole] = useState<Role>('MEMBER')
  const [status, setStatus] = useState<StatusChoice>('active')
  const [pending, setPending] = useState(false)

  // Subset that the server will actually accept (admin can't modify self).
  const targets = useMemo(
    () => selectedIds.filter((id) => id !== currentUserId),
    [selectedIds, currentUserId],
  )
  const skippedSelf = selectedIds.length !== targets.length

  // Esc deselects everything (only when no modal is open).
  useEffect(() => {
    if (selectedIds.length === 0) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dialog === null) onClear()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedIds.length, dialog, onClear])

  const closeDialog = () => {
    if (!pending) setDialog(null)
  }

  const runPatch = async (
    body: Record<string, unknown>,
    successCopy: (n: number) => string,
    errorCopy: string,
  ) => {
    if (targets.length === 0) {
      toast.info('Nothing to update', {
        description: skippedSelf
          ? 'You can only run bulk actions on other members.'
          : undefined,
      })
      return
    }
    setPending(true)
    try {
      const results = await Promise.allSettled(
        targets.map((id) =>
          fetch(`/api/admin/members/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }).then(async (res) => {
            const json = await res.json().catch(() => ({}))
            if (!res.ok || !json.success) {
              throw new Error(json.error?.message ?? errorCopy)
            }
            return json
          }),
        ),
      )

      const succeeded = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.length - succeeded

      if (succeeded > 0) {
        toast.success(successCopy(succeeded), {
          description: skippedSelf
            ? 'Your own account was skipped.'
            : failed > 0
              ? `${failed} could not be updated.`
              : undefined,
        })
      }
      if (failed > 0 && succeeded === 0) {
        const first = results.find(
          (r): r is PromiseRejectedResult => r.status === 'rejected',
        )
        toast.error(first?.reason?.message ?? errorCopy)
      }

      if (succeeded > 0) {
        onClear()
        onRefetch()
      }
    } finally {
      setPending(false)
      setDialog(null)
    }
  }

  const applyRole = () =>
    runPatch(
      { role },
      (n) => `${n} member${n === 1 ? '' : 's'} set to ${roleLabel(role)}`,
      'Could not update roles',
    )

  const applyStatus = () =>
    runPatch(
      { isActive: status === 'active' },
      (n) =>
        status === 'active'
          ? `${n} member${n === 1 ? '' : 's'} reactivated`
          : `${n} member${n === 1 ? '' : 's'} suspended`,
      'Could not update access',
    )

  const applyArchive = () =>
    runPatch(
      { archive: true },
      (n) => `${n} member${n === 1 ? '' : 's'} archived`,
      'Could not archive members',
    )

  const exportSelected = () => {
    const rows = members.filter((m) => selectedIds.includes(m.id))
    if (rows.length === 0) {
      toast.info('Nothing to export')
      return
    }
    const csv = toCsv(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `members-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(`Exported ${rows.length} member${rows.length === 1 ? '' : 's'}`)
  }

  if (selectedIds.length === 0) return null

  return (
    <>
      <div
        role="region"
        aria-label="Bulk actions"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4"
      >
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border bg-popover px-2 py-1.5 shadow-lg ring-1 ring-foreground/10 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium tabular-nums text-primary">
            {selectedIds.length} selected
          </span>
          <span className="mx-0.5 h-5 w-px bg-border" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDialog('role')}
            disabled={pending}
          >
            <ShieldCheck className="size-4" />
            Assign role
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDialog('status')}
            disabled={pending}
          >
            <UserX className="size-4" />
            Change status
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDialog('archive')}
            disabled={pending}
            className="text-destructive hover:text-destructive"
          >
            <Archive className="size-4" />
            Archive
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={exportSelected}
            disabled={pending}
          >
            <Download className="size-4" />
            Export
          </Button>
          <span className="mx-0.5 h-5 w-px bg-border" />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClear}
            aria-label="Clear selection"
            disabled={pending}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <Dialog
        open={dialog === 'role'}
        onOpenChange={(open) => (open ? null : closeDialog())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign role</DialogTitle>
            <DialogDescription>
              Set a new role for {targets.length} selected{' '}
              {targets.length === 1 ? 'member' : 'members'}
              {skippedSelf ? ' (your account is skipped)' : ''}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="bulk-role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger id="bulk-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="MEMBER">Member</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={closeDialog}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              onClick={applyRole}
              disabled={pending || targets.length === 0}
            >
              {pending ? 'Updating…' : 'Apply role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog === 'status'}
        onOpenChange={(open) => (open ? null : closeDialog())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change access status</DialogTitle>
            <DialogDescription>
              {status === 'suspended'
                ? `Suspending blocks ${targets.length} ${
                    targets.length === 1 ? 'member' : 'members'
                  } from signing in until reactivated.`
                : `Reactivate ${targets.length} ${
                    targets.length === 1 ? 'member' : 'members'
                  } so they can sign in again.`}
              {skippedSelf ? ' Your account is skipped.' : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="bulk-status">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as StatusChoice)}
            >
              <SelectTrigger id="bulk-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={closeDialog}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              onClick={applyStatus}
              disabled={pending || targets.length === 0}
              className={
                status === 'suspended'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : undefined
              }
            >
              {pending
                ? 'Updating…'
                : status === 'active'
                  ? 'Reactivate'
                  : 'Suspend access'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={dialog === 'archive'}
        onOpenChange={(open) => (open ? null : closeDialog())}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Archive {targets.length}{' '}
              {targets.length === 1 ? 'member' : 'members'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They&apos;ll be removed from the active roster and lose access
              immediately. History is preserved and can be restored from the
              Archived view.
              {skippedSelf ? ' Your account is skipped.' : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                applyArchive()
              }}
              disabled={pending || targets.length === 0}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pending ? 'Archiving…' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function roleLabel(role: Role) {
  return role === 'ADMIN' ? 'Admin' : 'Member'
}

function toCsv(rows: MemberListItem[]) {
  const header = [
    'Name',
    'Email',
    'Role',
    'Status',
    'Joined',
    'Last active',
  ]
  const body = rows.map((r) => [
    r.name ?? '',
    r.email,
    r.role,
    r.deletedAt ? 'Archived' : r.isActive ? 'Active' : 'Suspended',
    r.createdAt ? new Date(r.createdAt).toISOString() : '',
    r.lastLoginAt ? new Date(r.lastLoginAt).toISOString() : '',
  ])
  return [header, ...body]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n')
}

function csvCell(value: string) {
  const needsQuote = /[",\r\n]/.test(value)
  const escaped = value.replace(/"/g, '""')
  return needsQuote ? `"${escaped}"` : escaped
}

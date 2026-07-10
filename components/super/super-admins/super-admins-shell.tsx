'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { Loader2, Plus, ShieldCheck, ShieldOff } from 'lucide-react'
import { toast } from 'sonner'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import type { SuperAdminRow } from '@/lib/services/super-admin-service'
import { getInitials } from '@/lib/format'
import {
  fetchSuperAdmins,
  grantSuperAdminAction,
  revokeSuperAdminAction,
} from '@/app/(super)/super/super-admins/actions'

interface SuperAdminsShellProps {
  initialRows: SuperAdminRow[]
}

export function SuperAdminsShell({ initialRows }: SuperAdminsShellProps) {
  const router = useRouter()
  const [rows, setRows] = useState(initialRows)
  const [, startTransition] = useTransition()

  const [grantOpen, setGrantOpen] = useState(false)
  const [grantEmail, setGrantEmail] = useState('')
  const [grantName, setGrantName] = useState('')
  const [granting, setGranting] = useState(false)

  const [revokeTarget, setRevokeTarget] = useState<SuperAdminRow | null>(null)
  const [revoking, setRevoking] = useState(false)

  async function refresh() {
    try {
      const next = await fetchSuperAdmins()
      setRows(next)
    } catch (err) {
      console.error('refresh super-admins failed', err)
    }
  }

  async function handleGrant() {
    const email = grantEmail.trim()
    if (!email) return
    setGranting(true)
    try {
      const result = await grantSuperAdminAction({
        email,
        name: grantName.trim() || undefined,
      })
      if (!result.ok) {
        toast.error(result.error ?? 'Failed to grant super-admin')
        return
      }
      toast.success(
        result.wasNewlyCreated
          ? `Created ${email} and granted super-admin`
          : `Granted super-admin to ${email}`,
      )
      setGrantOpen(false)
      setGrantEmail('')
      setGrantName('')
      await refresh()
      startTransition(() => router.refresh())
    } catch (err) {
      console.error(err)
      toast.error('Failed to grant super-admin')
    } finally {
      setGranting(false)
    }
  }

  async function handleRevoke() {
    if (!revokeTarget) return
    setRevoking(true)
    try {
      const result = await revokeSuperAdminAction({ userId: revokeTarget.id })
      if (!result.ok) {
        toast.error(result.error ?? 'Failed to revoke super-admin')
        return
      }
      toast.success(
        `Revoked super-admin from ${revokeTarget.name || revokeTarget.email}`,
      )
      setRevokeTarget(null)
      await refresh()
      startTransition(() => router.refresh())
    } catch (err) {
      console.error(err)
      toast.error('Failed to revoke super-admin')
    } finally {
      setRevoking(false)
    }
  }

  const empty = rows.length === 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={() => setGrantOpen(true)}>
          <Plus className="size-4" />
          Grant super-admin
        </Button>
      </div>

      {empty ? (
        <EmptyState
          icon={ShieldCheck}
          title="No super-admins yet"
          description="Someone has to hold the master key. Grant it to a user to unlock the /super surface."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Last active</th>
                <th className="px-4 py-2.5">Granted</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => {
                const initials = getInitials(row.name, row.email)
                return (
                  <tr key={row.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          {row.avatarUrl ? (
                            <AvatarImage src={row.avatarUrl} alt="" />
                          ) : null}
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-medium">
                              {row.name || row.email.split('@')[0]}
                            </span>
                            {row.isSelf ? (
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                You
                              </span>
                            ) : null}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {row.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.lastActiveAt
                        ? formatDistanceToNow(row.lastActiveAt, {
                            addSuffix: true,
                          })
                        : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDistanceToNow(row.createdAt, { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={row.isSelf}
                        title={
                          row.isSelf
                            ? 'You cannot revoke your own super-admin flag'
                            : 'Revoke super-admin'
                        }
                        onClick={() => setRevokeTarget(row)}
                      >
                        <ShieldOff className="size-3.5" />
                        Revoke
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={grantOpen}
        onOpenChange={(v) => {
          if (granting) return
          setGrantOpen(v)
          if (!v) {
            setGrantEmail('')
            setGrantName('')
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Grant super-admin</DialogTitle>
            <DialogDescription>
              Type an email. If the user already exists on the platform,
              we flip the flag. Otherwise we create a fresh account and
              hand them the master key.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="grant-email">Email</Label>
              <Input
                id="grant-email"
                type="email"
                value={grantEmail}
                onChange={(e) => setGrantEmail(e.target.value)}
                placeholder="ruby@kondense.ai"
                autoFocus
                disabled={granting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="grant-name">Name (optional)</Label>
              <Input
                id="grant-name"
                value={grantName}
                onChange={(e) => setGrantName(e.target.value)}
                placeholder="Used only when creating a fresh account"
                disabled={granting}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setGrantOpen(false)}
              disabled={granting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleGrant}
              disabled={granting || !grantEmail.trim()}
            >
              {granting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Granting…
                </>
              ) : (
                'Grant'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={revokeTarget !== null}
        onOpenChange={(v) => {
          if (revoking) return
          if (!v) setRevokeTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Revoke super-admin?
            </DialogTitle>
            <DialogDescription>
              {revokeTarget?.name || revokeTarget?.email} will lose the
              ability to reach /super or enter any tenant without an
              explicit membership. Their user account and existing
              memberships stay untouched.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRevokeTarget(null)}
              disabled={revoking}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRevoke}
              disabled={revoking}
            >
              {revoking ? (
                <>
                  <Loader2 className="animate-spin" />
                  Revoking…
                </>
              ) : (
                'Revoke'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

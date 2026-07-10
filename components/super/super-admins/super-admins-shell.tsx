'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import type { SuperAdminRow } from '@/lib/services/super-admin-service'
import { fmtCalendarDate, getInitials } from '@/lib/format'
import {
  fetchSuperAdmins,
  grantSuperAdminAction,
  revokeSuperAdminAction,
} from '@/app/(super)/super/super-admins/actions'

interface SuperAdminsShellProps {
  initialRows: SuperAdminRow[]
}

const ROLE_STYLE: Record<
  SuperAdminRow['grant']['role'],
  { label: string; className: string; description: string }
> = {
  MASTER: {
    label: 'Master',
    className:
      'bg-brand-500/10 text-brand-600 ring-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/40',
    description:
      'Full platform power — create/delete companies, grant + revoke other super-admins, enter any tenant.',
  },
  SUPPORT: {
    label: 'Support',
    className:
      'bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900/50',
    description:
      'Read-write inside any tenant. Cannot delete companies or hand out super-admin.',
  },
  AUDITOR: {
    label: 'Auditor',
    className:
      'bg-neutral-100 text-neutral-700 ring-neutral-200 dark:bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-800',
    description: 'Read-only across every tenant.',
  },
}

export function SuperAdminsShell({ initialRows }: SuperAdminsShellProps) {
  const router = useRouter()
  const [rows, setRows] = useState(initialRows)
  const [, startTransition] = useTransition()

  const [grantOpen, setGrantOpen] = useState(false)
  const [grantEmail, setGrantEmail] = useState('')
  const [grantName, setGrantName] = useState('')
  const [grantRole, setGrantRole] =
    useState<SuperAdminRow['grant']['role']>('MASTER')
  const [grantExpires, setGrantExpires] = useState('')
  const [grantNotes, setGrantNotes] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [granting, setGranting] = useState(false)

  const [revokeTarget, setRevokeTarget] = useState<SuperAdminRow | null>(null)
  const [revoking, setRevoking] = useState(false)

  function resetGrantForm() {
    setGrantEmail('')
    setGrantName('')
    setGrantRole('MASTER')
    setGrantExpires('')
    setGrantNotes('')
    setAdvancedOpen(false)
  }

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
        role: grantRole,
        expiresAt: grantExpires ? grantExpires : null,
        notes: grantNotes.trim() ? grantNotes.trim() : null,
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
      resetGrantForm()
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
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Granted by</th>
                <th className="px-4 py-2.5">Granted</th>
                <th className="px-4 py-2.5">Expires</th>
                <th className="px-4 py-2.5">Last active</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => {
                const initials = getInitials(row.name, row.email)
                const roleMeta = ROLE_STYLE[row.grant.role]
                const grantedBy = row.grant.grantedBy
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
                    <td className="px-4 py-3">
                      <span
                        title={roleMeta.description}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
                          roleMeta.className,
                        )}
                      >
                        <ShieldCheck className="size-3" />
                        {roleMeta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {grantedBy
                        ? grantedBy.name || grantedBy.email.split('@')[0]
                        : 'System'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDistanceToNow(row.grant.grantedAt, {
                        addSuffix: true,
                      })}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.grant.expiresAt
                        ? fmtCalendarDate(row.grant.expiresAt)
                        : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.lastActiveAt
                        ? formatDistanceToNow(row.lastActiveAt, {
                            addSuffix: true,
                          })
                        : 'Never'}
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
          if (!v) resetGrantForm()
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

            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {advancedOpen ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
              {advancedOpen ? 'Hide' : 'Show'} advanced options
            </button>

            {advancedOpen ? (
              <div className="space-y-4 rounded-md border border-dashed p-3">
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['MASTER', 'SUPPORT', 'AUDITOR'] as const).map((r) => {
                      const style = ROLE_STYLE[r]
                      const selected = grantRole === r
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setGrantRole(r)}
                          disabled={granting}
                          className={cn(
                            'flex flex-col items-start gap-1 rounded-md border p-2 text-left transition-colors',
                            selected
                              ? 'border-primary/50 bg-primary/[0.04]'
                              : 'hover:border-input hover:bg-muted/40',
                          )}
                        >
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset',
                              style.className,
                            )}
                          >
                            <ShieldCheck className="size-2.5" />
                            {style.label}
                          </span>
                          <span className="text-[10px] leading-tight text-muted-foreground">
                            {style.description.split('.')[0]}.
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="grant-expires">Expires (optional)</Label>
                  <Input
                    id="grant-expires"
                    type="date"
                    value={grantExpires}
                    onChange={(e) => setGrantExpires(e.target.value)}
                    disabled={granting}
                  />
                  <p className="text-xs text-muted-foreground">
                    After this date the grant is auto-treated as revoked
                    by the hot-path check.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="grant-notes">Notes (optional)</Label>
                  <Textarea
                    id="grant-notes"
                    value={grantNotes}
                    onChange={(e) => setGrantNotes(e.target.value)}
                    placeholder="Ticket #, requester, context…"
                    rows={2}
                    disabled={granting}
                  />
                </div>
              </div>
            ) : null}
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

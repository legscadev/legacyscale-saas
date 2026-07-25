'use client'

// Assign custom roles to a TEAM user. Replaces the older per-
// module checkbox grid: admins pick from the roles defined on
// /admin/roles instead of granting individual modules. Save
// replaces the user's entire assignment set.

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

import {
  fetchAvailableRolesAction,
  fetchUserRolesAction,
  setUserRolesAction,
} from '@/app/(admin)/admin/team/actions'
import type {
  AssignedRole,
  RoleSummary,
} from '@/lib/services/role-service'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface RoleAssignmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: { id: string; name: string | null; email: string } | null
}

export function RoleAssignmentDialog({
  open,
  onOpenChange,
  target,
}: RoleAssignmentDialogProps) {
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [availableRoles, setAvailableRoles] = useState<RoleSummary[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open || !target) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    ;(async () => {
      const [rolesRes, assignedRes] = await Promise.all([
        fetchAvailableRolesAction(),
        fetchUserRolesAction(target.id),
      ])
      if (cancelled) return
      setLoading(false)
      if (!rolesRes.ok) {
        setLoadError(rolesRes.error ?? 'Could not load roles')
        return
      }
      if (!assignedRes.ok) {
        setLoadError(assignedRes.error ?? 'Could not load current assignments')
        return
      }
      setAvailableRoles(rolesRes.data)
      setSelectedIds(new Set(assignedRes.data.map((a: AssignedRole) => a.roleId)))
    })()
    return () => {
      cancelled = true
    }
  }, [open, target])

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSave = async () => {
    if (!target) return
    setSaving(true)
    const res = await setUserRolesAction({
      targetUserId: target.id,
      roleIds: [...selectedIds],
    })
    setSaving(false)
    if (!res.ok) {
      toast.error(res.error ?? 'Could not update roles')
      return
    }
    toast.success('Roles updated')
    onOpenChange(false)
  }

  const sortedRoles = useMemo(
    () =>
      [...availableRoles].sort((a, b) => {
        // System roles first, then alpha.
        if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1
        return a.name.localeCompare(b.name)
      }),
    [availableRoles],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Assign roles
          </DialogTitle>
          <DialogDescription>
            {target ? (
              <>
                Choose which roles <b>{target.name ?? target.email}</b> holds.
                Effective module access is the union of every role assigned.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : loadError ? (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{loadError}</span>
          </div>
        ) : sortedRoles.length === 0 ? (
          <div className="rounded-md border p-4 text-sm text-muted-foreground">
            No roles defined yet. Create one on the{' '}
            <a href="/admin/roles" className="underline">
              Roles
            </a>{' '}
            page first.
          </div>
        ) : (
          <div className="max-h-96 space-y-1.5 overflow-y-auto">
            {sortedRoles.map((role) => {
              const checked = selectedIds.has(role.id)
              return (
                <label
                  key={role.id}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors',
                    checked ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggle(role.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{role.name}</span>
                      {role.isSystem ? (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                          System
                        </span>
                      ) : null}
                    </div>
                    {role.description ? (
                      <p className="text-xs text-muted-foreground">
                        {role.description}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {role.moduleKeys.length} module
                      {role.moduleKeys.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

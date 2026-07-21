'use client'

// Modal for granting/revoking Internal-module access to a single
// TEAM user. Renders one checkbox per module from the catalog;
// optimistic toggle with rollback + toast on error.
//
// Loads the current grants when the dialog opens (not on parent
// render) so we don't waterfall a fetch per row on the members
// list.

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

import {
  fetchTeamAccessAction,
  grantModuleAccessAction,
  revokeModuleAccessAction,
} from '@/app/(admin)/admin/team/actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TEAM_MODULES, type TeamModuleKey } from '@/lib/config/team-modules'
import { cn } from '@/lib/utils'

interface AccessGridDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: { id: string; name: string | null; email: string } | null
}

/** Client-side view state: keyed by moduleKey. */
interface RowState {
  granted: boolean
  /** True while a grant/revoke round-trip is in flight for this
   *  row. Disables the input + shows a spinner. */
  saving: boolean
}

type State = Record<TeamModuleKey, RowState>

const EMPTY_STATE: State = TEAM_MODULES.reduce(
  (acc, m) => ({ ...acc, [m.key]: { granted: false, saving: false } }),
  {} as State,
)

export function AccessGridDialog({
  open,
  onOpenChange,
  target,
}: AccessGridDialogProps) {
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [state, setState] = useState<State>(EMPTY_STATE)

  useEffect(() => {
    if (!open || !target) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    setState(EMPTY_STATE)
    fetchTeamAccessAction(target.id).then((res) => {
      if (cancelled) return
      setLoading(false)
      if (!res.ok) {
        setLoadError(res.error ?? 'Could not load access')
        return
      }
      const next: State = { ...EMPTY_STATE }
      for (const grant of res.data) {
        next[grant.moduleKey] = { granted: true, saving: false }
      }
      setState(next)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target?.id])

  async function toggle(key: TeamModuleKey, nextGranted: boolean) {
    if (!target) return
    const prev = state[key]
    // Optimistic update — flip the visible state now, roll back
    // on error.
    setState((s) => ({ ...s, [key]: { granted: nextGranted, saving: true } }))

    const res = nextGranted
      ? await grantModuleAccessAction({
          targetUserId: target.id,
          moduleKey: key,
        })
      : await revokeModuleAccessAction({
          targetUserId: target.id,
          moduleKey: key,
        })

    if (!res.ok) {
      toast.error(res.error ?? 'Could not update access')
      setState((s) => ({ ...s, [key]: prev }))
      return
    }
    setState((s) => ({
      ...s,
      [key]: { granted: nextGranted, saving: false },
    }))
    toast.success(
      nextGranted
        ? `Granted ${labelFor(key)}`
        : `Revoked ${labelFor(key)}`,
    )
  }

  const displayName = useMemo(() => {
    if (!target) return ''
    return target.name?.trim() || target.email.split('@')[0]!
  }, [target])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage access — {displayName}</DialogTitle>
          <DialogDescription>
            Toggle which Internal modules this TEAM member can reach.
            Changes take effect on their next navigation.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading access…
          </div>
        ) : loadError ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{loadError}</span>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {TEAM_MODULES.map((m) => {
              const row = state[m.key]
              const Icon = m.icon
              return (
                <li
                  key={m.key}
                  className={cn(
                    'flex items-start gap-3 rounded-md border p-3 transition-colors',
                    row.granted && 'border-primary/40 bg-primary/5',
                    row.saving && 'opacity-70',
                  )}
                >
                  <input
                    type="checkbox"
                    id={`access-${m.key}`}
                    checked={row.granted}
                    disabled={row.saving}
                    onChange={(e) => toggle(m.key, e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary"
                  />
                  <label
                    htmlFor={`access-${m.key}`}
                    className="min-w-0 flex-1 cursor-pointer"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Icon
                        className="size-3.5 text-muted-foreground"
                        aria-hidden
                      />
                      {m.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {m.description}
                    </span>
                  </label>
                  {row.saving ? (
                    <Loader2
                      className="mt-1 size-3.5 shrink-0 animate-spin text-muted-foreground"
                      aria-hidden
                    />
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}

        <div className="rounded-md border bg-muted/30 p-2 text-[11px] text-muted-foreground">
          <div className="flex items-start gap-1.5">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              ADMIN staff always have full access. Only TEAM members can
              be scoped through this grid.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function labelFor(key: TeamModuleKey): string {
  return TEAM_MODULES.find((m) => m.key === key)?.label ?? key
}

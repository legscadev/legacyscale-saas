'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { format } from 'date-fns'
import { Loader2, Plus, Search, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { PositionAssignmentRow } from '@/lib/services/org-board-service'
import {
  EMPLOYMENT_TYPE_LABELS,
  type EmploymentTypeValue,
} from '@/lib/validations/org-board'

import {
  addPositionAssignmentAction,
  endPositionAssignmentAction,
  listPositionAssignmentsAction,
  resolveHolderToEmployeeAction,
  searchAssignableEmployeesAction,
} from '@/app/(admin)/admin/org-board/actions'

interface PositionAssignmentsPanelProps {
  nodeId: string
  /** Called after any successful mutation so the parent can
   *  invalidate its own state (badge count, holder chip, etc). */
  onChange?: () => void
}

interface EmployeeSearchRow {
  /** See notes on the dialogs' EmployeeRef — same discriminator. */
  kind: 'employee' | 'user'
  id: string
  email: string
  name: string | null
  role: 'ADMIN' | 'TEAM' | 'MEMBER'
}

const NO_EMPLOYMENT_TYPE = '__none__'

export function PositionAssignmentsPanel({
  nodeId,
  onChange,
}: PositionAssignmentsPanelProps) {
  const [rows, setRows] = useState<PositionAssignmentRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [pending, startTransition] = useTransition()

  const refresh = useCallback(() => {
    let cancelled = false
    // Queue the loading flag off the current tick so the setState
    // never happens synchronously in an effect body — that pattern
    // is flagged by react-hooks/purity.
    queueMicrotask(() => {
      if (cancelled) return
      setLoading(true)
    })
    listPositionAssignmentsAction(nodeId, { includeEnded: false })
      .then((data) => {
        if (cancelled) return
        setRows(data)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        toast.error('Failed to load assignments')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [nodeId])

  useEffect(() => {
    return refresh()
  }, [refresh])

  function handleEnd(id: string, name: string) {
    startTransition(async () => {
      try {
        await endPositionAssignmentAction(id, nodeId)
        toast.success(`Ended assignment for ${name}`)
        refresh()
        onChange?.()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to end')
      }
    })
  }

  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-semibold">
            Assignments{rows ? ` (${rows.length})` : ''}
          </Label>
          <p className="text-xs text-muted-foreground">
            Who currently holds this seat. Multiple holders are supported.
          </p>
        </div>
        {!adding ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAdding(true)}
            disabled={pending}
          >
            <Plus className="mr-1 size-3.5" />
            Add
          </Button>
        ) : null}
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Loading…
        </p>
      ) : rows && rows.length > 0 ? (
        <ul className="divide-y rounded-md border bg-card">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-2 px-3 py-2 text-sm"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                {(row.employee.name || '?').slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{row.employee.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.employee.roleTitle}
                  {row.employmentType
                    ? ` · ${EMPLOYMENT_TYPE_LABELS[row.employmentType]}`
                    : ''}
                  {' · since '}
                  {format(row.dateAssigned, 'MMM d, yyyy')}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleEnd(row.id, row.employee.name ?? 'holder')
                }
                disabled={pending}
                aria-label="End assignment"
                className="grid size-7 place-items-center rounded text-muted-foreground/70 hover:bg-muted hover:text-destructive disabled:opacity-40"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed py-3 text-center text-xs text-muted-foreground">
          No active assignments.
        </p>
      )}

      {adding ? (
        <AddAssignmentForm
          nodeId={nodeId}
          onCancel={() => setAdding(false)}
          onAdded={() => {
            setAdding(false)
            refresh()
            onChange?.()
          }}
        />
      ) : null}
    </div>
  )
}

function AddAssignmentForm({
  nodeId,
  onCancel,
  onAdded,
}: {
  nodeId: string
  onCancel: () => void
  onAdded: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<EmployeeSearchRow[]>([])
  const [picked, setPicked] = useState<EmployeeSearchRow | null>(null)
  const [employmentType, setEmploymentType] = useState<string>(NO_EMPLOYMENT_TYPE)
  const [notes, setNotes] = useState('')
  const [pending, startTransition] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (picked) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = query.trim()
    debounceRef.current = setTimeout(() => {
      if (!q) {
        setResults([])
        return
      }
      startTransition(async () => {
        try {
          const rows = await searchAssignableEmployeesAction(q)
          setResults(rows)
        } catch {
          setResults([])
        }
      })
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, picked])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!picked || pending) return
    startTransition(async () => {
      try {
        const employeeId = await resolveHolderToEmployeeAction({
          kind: picked.kind,
          id: picked.id,
        })
        await addPositionAssignmentAction(nodeId, {
          employeeId,
          employmentType:
            employmentType === NO_EMPLOYMENT_TYPE
              ? null
              : (employmentType as EmploymentTypeValue),
          notes: notes.trim() || null,
        })
        toast.success(`Assigned ${picked.name ?? picked.email}`)
        onAdded()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to assign')
      }
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-md border bg-card p-3"
    >
      {picked ? (
        <div className="flex items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
            {(picked.name ?? picked.email).slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {picked.name ?? picked.email}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {picked.email}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPicked(null)}
            aria-label="Clear pick"
            className="grid size-7 place-items-center rounded text-muted-foreground/70 hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search an employee to assign…"
              disabled={pending}
              className="pl-8"
              autoComplete="off"
              autoFocus
            />
          </div>
          {query.trim() && results.length > 0 ? (
            <ul className="max-h-40 overflow-hidden rounded-md border bg-background">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setPicked(r)}
                    className={cn(
                      'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-muted',
                    )}
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-medium">
                      {(r.name ?? r.email).slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">
                        {r.name ?? r.email}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {r.email} · {r.role.toLowerCase()}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="assignment-employment-type" className="text-xs">
            Employment type
          </Label>
          <Select
            value={employmentType}
            onValueChange={(v) => setEmploymentType(v ?? NO_EMPLOYMENT_TYPE)}
          >
            <SelectTrigger id="assignment-employment-type" className="h-8 w-full">
              <SelectValue>
                {(v: string) =>
                  v === NO_EMPLOYMENT_TYPE
                    ? 'Not specified'
                    : EMPLOYMENT_TYPE_LABELS[v as EmploymentTypeValue]
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_EMPLOYMENT_TYPE}>Not specified</SelectItem>
              {(Object.keys(EMPLOYMENT_TYPE_LABELS) as EmploymentTypeValue[]).map(
                (k) => (
                  <SelectItem key={k} value={k}>
                    {EMPLOYMENT_TYPE_LABELS[k]}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="assignment-notes" className="text-xs">
            Notes (optional)
          </Label>
          <Input
            id="assignment-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Context for this assignment"
            className="h-8"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending || !picked}>
          {pending ? (
            <>
              <Loader2 className="mr-1 size-3.5 animate-spin" />
              Adding…
            </>
          ) : (
            'Assign'
          )}
        </Button>
      </div>
    </form>
  )
}

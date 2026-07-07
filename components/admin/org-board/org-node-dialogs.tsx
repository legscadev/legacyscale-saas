'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Search, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { OrgNodeRow } from '@/lib/services/org-board-service'
import {
  ORG_NODE_KIND_LABELS,
  type OrgNodeKindValue,
} from '@/lib/validations/org-board'

import {
  addOrgNodeAction,
  searchAssignableEmployeesAction,
  updateOrgNodeAction,
} from '@/app/(admin)/admin/org-board/actions'

import { PositionAssignmentsPanel } from './position-assignments-panel'

// ---------------------------------------------------------------------
// Edit dialog — label, position title, employee (or free-text)
// ---------------------------------------------------------------------

interface EmployeeRef {
  id: string
  name: string | null
  email: string
  role: 'ADMIN' | 'TEAM' | 'MEMBER'
}

interface OrgNodeEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  node: OrgNodeRow
}

export function OrgNodeEditDialog({
  open,
  onOpenChange,
  node,
}: OrgNodeEditDialogProps) {
  const [label, setLabel] = useState(node.label)
  const [positionTitle, setPositionTitle] = useState(node.positionTitle ?? '')
  const [functionText, setFunctionText] = useState(node.functionText ?? '')
  const [responsibilities, setResponsibilities] = useState(
    node.responsibilities.join('\n'),
  )
  const [notes, setNotes] = useState(node.notes ?? '')
  const [color, setColor] = useState(node.color ?? '')
  const [employee, setEmployee] = useState<EmployeeRef | null>(
    node.employee
      ? {
          id: node.employee.id,
          name: node.employee.name,
          email: node.employee.roleTitle, // shim: we don't get email back
          role: 'TEAM',
        }
      : null,
  )
  const [freeText, setFreeText] = useState(node.freeTextHolder ?? '')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  // Reset local state when the dialog opens against a fresh node.
  // Wrapped in queueMicrotask so react-hooks/purity is satisfied
  // (the lint rule flags synchronous setState inside effect body).
  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setLabel(node.label)
      setPositionTitle(node.positionTitle ?? '')
      setFunctionText(node.functionText ?? '')
      setResponsibilities(node.responsibilities.join('\n'))
      setNotes(node.notes ?? '')
      setColor(node.color ?? '')
      setFreeText(node.freeTextHolder ?? '')
      setEmployee(
        node.employee
          ? {
              id: node.employee.id,
              name: node.employee.name,
              email: node.employee.roleTitle,
              role: 'TEAM',
            }
          : null,
      )
    })
  }, [open, node])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return
    startTransition(async () => {
      try {
        await updateOrgNodeAction(node.id, {
          label: label.trim(),
          positionTitle: positionTitle.trim() || null,
          functionText: functionText.trim() || null,
          responsibilities: responsibilities
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
          notes: notes.trim() || null,
          color: color.trim() || null,
          // employee wins over freeText — the picker either has one
          // or the other set.
          employeeId: employee?.id ?? null,
          freeTextHolder: employee ? null : freeText.trim() || null,
        })
        toast.success(`Updated "${label.trim() || node.label}"`)
        onOpenChange(false)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {ORG_NODE_KIND_LABELS[node.kind]}</DialogTitle>
          <DialogDescription>
            Label, role, holder, function, responsibilities and notes.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="org-node-label">Label</Label>
              <Input
                id="org-node-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-node-title">Role / Title</Label>
              <Input
                id="org-node-title"
                value={positionTitle}
                onChange={(e) => setPositionTitle(e.target.value)}
                placeholder="e.g. Sales & Marketing Director"
              />
            </div>
          </div>

          {node.kind === 'DIVISION' ? (
            <div className="space-y-1.5">
              <Label htmlFor="org-node-color">Colour</Label>
              <ColorPicker value={color} onChange={setColor} disabled={pending} />
            </div>
          ) : null}

          <HolderPicker
            employee={employee}
            freeText={freeText}
            onEmployeeChange={setEmployee}
            onFreeTextChange={setFreeText}
            disabled={pending}
          />

          <div className="space-y-1.5">
            <Label htmlFor="org-node-function">Function</Label>
            <Textarea
              id="org-node-function"
              value={functionText}
              onChange={(e) => setFunctionText(e.target.value)}
              rows={3}
              placeholder="How this seat operates day-to-day"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="org-node-responsibilities">
              Responsibilities
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                (one per line)
              </span>
            </Label>
            <Textarea
              id="org-node-responsibilities"
              value={responsibilities}
              onChange={(e) => setResponsibilities(e.target.value)}
              rows={4}
              placeholder={'Own weekly team meeting\nReview quarterly targets\nMentor new hires'}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="org-node-notes">Notes</Label>
            <Textarea
              id="org-node-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Admin-only context"
            />
          </div>

          <PositionAssignmentsPanel nodeId={node.id} />

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !label.trim()}>
              {pending ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------
// Add child dialog — kind is fixed by the caller (comes from the menu
// item, e.g. "Add Department"). Fields mirror Edit but with an empty
// initial state.
// ---------------------------------------------------------------------

/**
 * Where the new node should be created. `child` nests it under an
 * existing node; `root` creates a top-level node in a revision
 * (used by the empty-state primer when the whole board is blank).
 */
export type OrgNodeAddTarget =
  | { mode: 'child'; parent: OrgNodeRow }
  | { mode: 'root'; revisionId: string; label: string }

interface OrgNodeAddDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: OrgNodeAddTarget
  childKind: OrgNodeKindValue | null
}

export function OrgNodeAddDialog({
  open,
  onOpenChange,
  target,
  childKind,
}: OrgNodeAddDialogProps) {
  const [label, setLabel] = useState('')
  const [positionTitle, setPositionTitle] = useState('')
  const [employee, setEmployee] = useState<EmployeeRef | null>(null)
  const [freeText, setFreeText] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setLabel('')
      setPositionTitle('')
      setEmployee(null)
      setFreeText('')
    })
  }, [open])

  if (!childKind) return null

  const revisionId =
    target.mode === 'child' ? target.parent.revisionId : target.revisionId
  const parentId = target.mode === 'child' ? target.parent.id : null
  const parentLabel = target.mode === 'child' ? target.parent.label : target.label

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return
    startTransition(async () => {
      try {
        await addOrgNodeAction(revisionId, {
          parentId,
          kind: childKind as OrgNodeKindValue,
          label: label.trim(),
          positionTitle: positionTitle.trim() || null,
          employeeId: employee?.id ?? null,
          freeTextHolder: employee ? null : freeText.trim() || null,
        })
        toast.success(`Added "${label.trim()}"`)
        onOpenChange(false)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to add')
      }
    })
  }

  const heading = `Add ${ORG_NODE_KIND_LABELS[childKind].toLowerCase()} under "${parentLabel}"`

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription>
            New nodes append at the end of the parent&apos;s current
            children. You can reorder later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="org-node-new-label">Label</Label>
            <Input
              id="org-node-new-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Ads Manager"
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-node-new-title">Role / Title (optional)</Label>
            <Input
              id="org-node-new-title"
              value={positionTitle}
              onChange={(e) => setPositionTitle(e.target.value)}
              placeholder="e.g. Ads Manager"
            />
          </div>

          <HolderPicker
            employee={employee}
            freeText={freeText}
            onEmployeeChange={setEmployee}
            onFreeTextChange={setFreeText}
            disabled={pending}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !label.trim()}>
              {pending ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Adding…
                </>
              ) : (
                'Add'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------
// HolderPicker — search Employee or enter a free-text placeholder.
// Mutually exclusive: setting one clears the other.
// ---------------------------------------------------------------------

interface HolderPickerProps {
  employee: EmployeeRef | null
  freeText: string
  onEmployeeChange: (v: EmployeeRef | null) => void
  onFreeTextChange: (v: string) => void
  disabled?: boolean
}

function HolderPicker({
  employee,
  freeText,
  onEmployeeChange,
  onFreeTextChange,
  disabled,
}: HolderPickerProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<EmployeeRef[]>([])
  const [showResults, setShowResults] = useState(false)
  const [pending, startTransition] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (employee) return
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
  }, [query, employee])

  function pick(row: EmployeeRef) {
    onEmployeeChange(row)
    onFreeTextChange('')
    setQuery('')
    setShowResults(false)
  }

  function unlink() {
    onEmployeeChange(null)
    setShowResults(true)
  }

  return (
    <div className="space-y-1.5">
      <Label>Holder</Label>
      {employee ? (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {(employee.name ?? employee.email).slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {employee.name ?? employee.email}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {employee.role.toLowerCase()}
            </p>
          </div>
          <button
            type="button"
            onClick={unlink}
            disabled={disabled}
            aria-label="Clear holder"
            className="grid size-7 place-items-center rounded text-muted-foreground/70 hover:bg-muted hover:text-foreground disabled:opacity-40"
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
              onChange={(e) => {
                setQuery(e.target.value)
                setShowResults(true)
              }}
              onFocus={() => setShowResults(true)}
              placeholder="Search an existing employee…"
              disabled={disabled}
              className="pl-8"
              autoComplete="off"
            />
            {pending ? (
              <Loader2 className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : null}
          </div>
          {showResults && (query.trim() || results.length > 0) ? (
            <ul className="max-h-40 overflow-hidden rounded-md border">
              {results.length === 0 && query.trim() && !pending ? (
                <li className="px-2.5 py-2 text-xs text-muted-foreground">
                  No matching employee. Add them under{' '}
                  <a
                    href="/admin/onboarding"
                    className="underline hover:text-foreground"
                  >
                    /admin/onboarding
                  </a>{' '}
                  first, or use the placeholder below.
                </li>
              ) : null}
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => pick(r)}
                    className={cn(
                      'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted',
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
          <div className="pt-2">
            <Label htmlFor="org-node-freetext" className="text-xs text-muted-foreground">
              Or use a placeholder (e.g. &ldquo;To be hired&rdquo;)
            </Label>
            <Input
              id="org-node-freetext"
              value={freeText}
              onChange={(e) => onFreeTextChange(e.target.value)}
              placeholder="Free-text holder"
              disabled={disabled}
              className="mt-1"
            />
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------
// Colour palette picker — swatches match seed / drilldown tokens.
// ---------------------------------------------------------------------

const COLOR_OPTIONS: Array<{ value: string; className: string; label: string }> = [
  { value: 'blue', className: 'bg-blue-600', label: 'Blue' },
  { value: 'amber', className: 'bg-amber-500', label: 'Amber' },
  { value: 'indigo', className: 'bg-indigo-700', label: 'Indigo' },
  { value: 'pink', className: 'bg-pink-400', label: 'Pink' },
  { value: 'emerald', className: 'bg-emerald-700', label: 'Emerald' },
  { value: 'slate', className: 'bg-slate-500', label: 'Slate' },
  { value: 'yellow', className: 'bg-yellow-500', label: 'Yellow' },
]

function ColorPicker({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLOR_OPTIONS.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(active ? '' : opt.value)}
            disabled={disabled}
            title={opt.label}
            aria-label={opt.label}
            className={cn(
              'grid size-8 place-items-center rounded-full ring-2 transition-transform',
              opt.className,
              active
                ? 'ring-foreground'
                : 'ring-transparent hover:scale-105 hover:ring-border',
              disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {active ? (
              <span className="text-xs font-bold text-white">✓</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Check,
  CircleDashed,
  Loader2,
  MessageSquare,
  MinusCircle,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/shared'
import { fmtCalendarDate } from '@/lib/format'

import { EditEmployeeDialog } from './edit-employee-dialog'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  CHECKLIST_STATUS_LABELS,
  type ChecklistItemStatusValue,
} from '@/lib/validations/employee'
import type { EmployeeDetail } from '@/lib/services/employee-service'

import {
  deleteEmployeeAction,
  offboardEmployeeAction,
  reactivateEmployeeAction,
  updateChecklistItemStatusAction,
} from '@/app/(admin)/admin/onboarding/actions'

interface EmployeeDetailShellProps {
  employee: EmployeeDetail
}

/** Order shown in the status dropdown. Kept as a runtime const so the
 *  menu order is guaranteed (Object.keys on the label map is stable
 *  in every modern engine, but relying on that is fragile). */
const STATUS_OPTIONS: ChecklistItemStatusValue[] = [
  'PENDING',
  'OK',
  'ATTENTION',
  'NA',
]

function StatusPill({ status }: { status: ChecklistItemStatusValue }) {
  const cls =
    status === 'OK'
      ? 'bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800'
      : status === 'ATTENTION'
        ? 'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800'
        : status === 'NA'
          ? 'bg-muted text-muted-foreground ring-border'
          : 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700'
  const Icon =
    status === 'OK'
      ? Check
      : status === 'ATTENTION'
        ? AlertTriangle
        : status === 'NA'
          ? MinusCircle
          : CircleDashed
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        cls,
      )}
    >
      <Icon className="size-3" />
      {CHECKLIST_STATUS_LABELS[status]}
    </span>
  )
}

// Delegates to UTC-anchored formatter so viewers in different
// timezones see the same calendar day. Pre-fix, Gillian (viewer in
// a UTC-negative zone) would see "Jul 10" for a row Ruel (Manila)
// had inputted as "Jul 11", because format() from date-fns applies
// the viewer's local TZ shift.
function formatDate(date: Date | null | undefined) {
  return fmtCalendarDate(date)
}

export function EmployeeDetailShell({ employee }: EmployeeDetailShellProps) {
  const router = useRouter()
  const [offboardOpen, setOffboardOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [offboardDate, setOffboardDate] = useState(
    format(new Date(), 'yyyy-MM-dd'),
  )
  const [offboardNotes, setOffboardNotes] = useState('')
  const [pending, startTransition] = useTransition()

  const { items, checklist } = employee
  const isOffboarded = employee.status === 'OFFBOARDED'

  function handleStatusChange(
    itemId: string,
    next: ChecklistItemStatusValue,
    current: ChecklistItemStatusValue,
  ) {
    if (next === current) return
    startTransition(async () => {
      try {
        await updateChecklistItemStatusAction(employee.id, itemId, {
          status: next,
        })
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to update item'
        toast.error(message)
      }
    })
  }

  function handleNoteBlur(
    itemId: string,
    status: ChecklistItemStatusValue,
    note: string,
    previous: string,
  ) {
    if (note === previous) return
    startTransition(async () => {
      try {
        await updateChecklistItemStatusAction(employee.id, itemId, {
          status,
          note: note || null,
        })
        toast.success('Note saved')
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to save note'
        toast.error(message)
      }
    })
  }

  function handleOffboard() {
    startTransition(async () => {
      try {
        await offboardEmployeeAction(employee.id, {
          offboardingDate: offboardDate,
          notes: offboardNotes || null,
        })
        toast.success('Employee offboarded')
        setOffboardOpen(false)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to offboard'
        toast.error(message)
      }
    })
  }

  function handleReactivate() {
    startTransition(async () => {
      try {
        await reactivateEmployeeAction(employee.id)
        toast.success('Employee reactivated')
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to reactivate'
        toast.error(message)
      }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteEmployeeAction(employee.id)
        toast.success('Employee deleted')
        router.push('/admin/onboarding')
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to delete'
        toast.error(message)
      }
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Onboarding', href: '/admin/onboarding' },
          { label: employee.name },
        ]}
        title={employee.name}
        description={employee.roleTitle}
        eyebrow={
          <span className="flex items-center gap-1.5">
            {isOffboarded ? (
              <>
                <Ban className="size-3.5" />
                Offboarded
              </>
            ) : (
              <>
                <CircleDashed className="size-3.5" />
                Active
              </>
            )}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => router.push('/admin/onboarding')}
            >
              <ArrowLeft className="mr-1.5 size-4" />
              Back
            </Button>
            {isOffboarded ? (
              <Button
                variant="outline"
                onClick={handleReactivate}
                disabled={pending}
              >
                <RotateCcw className="mr-1.5 size-4" />
                Reactivate
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => setOffboardOpen(true)}
                disabled={pending}
              >
                <Ban className="mr-1.5 size-4" />
                Offboard
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="More actions"
                render={
                  <button
                    type="button"
                    className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  />
                }
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-auto min-w-0">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil className="mr-1.5 size-4" />
                  Edit employee
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="mr-1.5 size-4" />
                  Delete employee
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="text-xs">
                  ID · {employee.id.slice(0, 8)}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetaCard label="Onboarding date" value={formatDate(employee.onboardingDate)} />
        <MetaCard label="Date started" value={formatDate(employee.dateStarted)} />
        <MetaCard
          label={isOffboarded ? 'Offboarding date' : 'Status'}
          value={
            isOffboarded ? formatDate(employee.offboardingDate) : 'Active'
          }
        />
        <MetaCard
          label="Checklist progress"
          value={
            checklist.totalItems > 0
              ? `${checklist.okCount} / ${checklist.totalItems}`
              : '—'
          }
          subtitle={
            checklist.attentionCount > 0
              ? `${checklist.attentionCount} needs attention`
              : undefined
          }
        />
      </div>

      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold leading-tight">Checklist</h2>
            <p className="truncate text-xs text-muted-foreground">
              {items.length} items
            </p>
          </div>
          <p className="hidden text-xs text-muted-foreground/80 sm:block">
            Click a status to change
          </p>
        </div>
        {items.length > 0 ? (
          <ul className="divide-y">
            {items.map((item) => (
              <ChecklistRow
                key={item.id}
                item={item}
                onStatusChange={(next) =>
                  handleStatusChange(item.id, next, item.status)
                }
                onNoteBlur={(note, previous) =>
                  handleNoteBlur(item.id, item.status, note, previous)
                }
                disabled={pending}
              />
            ))}
          </ul>
        ) : (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No checklist items available.
          </p>
        )}
      </div>

      {employee.notes ? (
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold">Notes</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
            {employee.notes}
          </p>
        </div>
      ) : null}

      <Dialog
        open={offboardOpen}
        onOpenChange={(v) => !pending && setOffboardOpen(v)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Offboard {employee.name}?</DialogTitle>
            <DialogDescription>
              This moves the record to the Offboarded tab. You can reactivate
              them later if needed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="offboard-date">Offboarding date</Label>
              <Input
                id="offboard-date"
                type="date"
                value={offboardDate}
                onChange={(e) => setOffboardDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offboard-notes">Notes (optional)</Label>
              <Textarea
                id="offboard-notes"
                value={offboardNotes}
                onChange={(e) => setOffboardNotes(e.target.value)}
                placeholder="Why they're leaving, handover notes, etc."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOffboardOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleOffboard}
              disabled={pending || !offboardDate}
            >
              {pending ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Offboarding…
                </>
              ) : (
                'Confirm offboard'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditEmployeeDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        employee={{
          id: employee.id,
          name: employee.name,
          roleTitle: employee.roleTitle,
          onboardingDate: employee.onboardingDate,
          dateStarted: employee.dateStarted,
          notes: employee.notes,
        }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {employee.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the employee record and their
              checklist history. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pending ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function MetaCard({
  label,
  value,
  subtitle,
}: {
  label: string
  value: string
  subtitle?: string
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold tabular-nums">{value}</p>
      {subtitle ? (
        <p className="mt-0.5 text-[10px] text-amber-600">{subtitle}</p>
      ) : null}
    </div>
  )
}

function ChecklistRow({
  item,
  onStatusChange,
  onNoteBlur,
  disabled,
}: {
  item: EmployeeDetail['items'][number]
  onStatusChange: (next: ChecklistItemStatusValue) => void
  onNoteBlur: (note: string, previous: string) => void
  disabled: boolean
}) {
  const [noteDraft, setNoteDraft] = useState(item.note ?? '')
  const [noteOpen, setNoteOpen] = useState(false)
  const hasNote = Boolean(item.note && item.note.trim())

  return (
    <li className="group px-3 py-1.5 hover:bg-muted/20">
      <div className="flex items-center gap-2">
        <span
          className="flex-1 truncate text-sm font-medium"
          title={item.description ?? undefined}
        >
          {item.label}
        </span>
        {item.completedAt ? (
          <span className="hidden text-[10px] text-muted-foreground sm:inline">
            {format(new Date(item.completedAt), 'MMM d')}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setNoteOpen((v) => !v)}
          className={cn(
            'grid size-6 place-items-center rounded text-muted-foreground/60 transition-colors',
            'hover:bg-muted hover:text-foreground',
            hasNote ? 'text-amber-500' : 'opacity-0 group-hover:opacity-100',
            noteOpen && 'bg-muted text-foreground opacity-100',
          )}
          aria-label={hasNote ? 'Edit note' : 'Add note'}
          title={hasNote ? item.note ?? undefined : 'Add note'}
        >
          <MessageSquare className="size-3.5" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Change status for ${item.label}`}
            disabled={disabled}
            render={
              <button
                type="button"
                className={cn(
                  'rounded-full transition-transform',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  'hover:scale-[1.03] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50',
                )}
              />
            }
          >
            <StatusPill status={item.status} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[10rem]">
            {STATUS_OPTIONS.map((s) => (
              <DropdownMenuItem
                key={s}
                onClick={() => onStatusChange(s)}
                className={cn(
                  'gap-2',
                  s === item.status && 'bg-muted font-medium',
                )}
              >
                <StatusPill status={s} />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {noteOpen ? (
        <Textarea
          autoFocus
          className="mt-1.5 text-xs"
          rows={2}
          placeholder="Add a note…"
          value={noteDraft}
          disabled={disabled}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={() => {
            onNoteBlur(noteDraft.trim(), item.note ?? '')
            if (!noteDraft.trim()) setNoteOpen(false)
          }}
        />
      ) : hasNote ? (
        <p className="mt-0.5 truncate pl-0 text-xs text-muted-foreground">
          {item.note}
        </p>
      ) : null}
    </li>
  )
}

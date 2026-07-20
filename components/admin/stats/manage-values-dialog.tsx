'use client'

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
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
import {
  deleteDataPointAction,
  upsertDataPointAction,
} from '@/app/(admin)/admin/stats/actions'
import { formatMetricValue, unitLabel, type MetricUnit } from '@/lib/format/stat'
import { fmtCalendarDate } from '@/lib/format'

interface ManageValuesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  metricId: string
  metricName: string
  unit: MetricUnit
  dataPoints: {
    id: string
    value: number
    recordedAt: Date
    note: string | null
  }[]
  /** When false, the delete controls are hidden — used for viewers
   *  who don't have write access to this metric. */
  canDelete: boolean
}

export function ManageValuesDialog({
  open,
  onOpenChange,
  metricId,
  metricName,
  unit,
  dataPoints,
  canDelete,
}: ManageValuesDialogProps) {
  const [value, setValue] = useState('')
  const [recordedAt, setRecordedAt] = useState(todayISO())
  const [note, setNote] = useState('')
  const [saving, startSave] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingDelete, startDelete] = useTransition()

  function reset() {
    setValue('')
    setRecordedAt(todayISO())
    setNote('')
    setDeletingId(null)
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  function handleSave() {
    const parsed = Number(value)
    if (!value.trim() || !Number.isFinite(parsed)) {
      toast.error('Value must be a number')
      return
    }
    startSave(async () => {
      const result = await upsertDataPointAction({
        metricId,
        recordedAt,
        value: parsed,
        note: note || null,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Value recorded')
      setValue('')
      setNote('')
    })
  }

  function handleDelete(id: string) {
    setDeletingId(id)
    startDelete(async () => {
      const result = await deleteDataPointAction(id)
      setDeletingId(null)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Value deleted')
    })
  }

  // Show most-recent-first in the history table.
  const historyRows = [...dataPoints].reverse()

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage values</DialogTitle>
          <DialogDescription>
            Record a new value or delete existing ones for{' '}
            <strong>{metricName}</strong>. Adding a value on a date that
            already has one overwrites it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-3 rounded-md border p-3">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Record value
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="stat-value">Value</Label>
                <Input
                  id="stat-value"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="0"
                  inputMode="decimal"
                />
                <p className="text-[11px] text-muted-foreground">
                  Unit: {unitLabel(unit)}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stat-recorded">Date</Label>
                <Input
                  id="stat-recorded"
                  type="date"
                  value={recordedAt}
                  onChange={(e) => setRecordedAt(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stat-note">Note (optional)</Label>
              <Textarea
                id="stat-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Context on this week's number."
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} size="sm">
                {saving ? 'Saving…' : 'Save value'}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Recent values
              </div>
              <span className="text-[11px] text-muted-foreground">
                {historyRows.length}{' '}
                {historyRows.length === 1 ? 'value' : 'values'}
              </span>
            </div>
            {historyRows.length === 0 ? (
              <p className="rounded-md border border-dashed bg-muted/20 p-3 text-center text-xs text-muted-foreground">
                No values recorded yet.
              </p>
            ) : (
              <ul className="max-h-56 overflow-y-auto rounded-md border">
                {historyRows.map((p) => {
                  const isDeleting =
                    pendingDelete && deletingId === p.id
                  return (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 text-sm">
                          <span className="font-semibold tabular-nums">
                            {formatMetricValue(p.value, unit)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {fmtCalendarDate(p.recordedAt)}
                          </span>
                        </div>
                        {p.note ? (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {p.note}
                          </p>
                        ) : null}
                      </div>
                      {canDelete ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id)}
                          disabled={pendingDelete}
                          aria-label="Delete value"
                          className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                        >
                          <Trash2
                            className={
                              'size-3.5 ' +
                              (isDeleting ? 'animate-pulse' : '')
                            }
                          />
                        </button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={saving || pendingDelete}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}


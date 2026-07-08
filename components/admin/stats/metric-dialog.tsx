'use client'

import { useState, useTransition } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  createMetricAction,
  updateMetricAction,
} from '@/app/(admin)/admin/stats/actions'
import { unitLabel, type MetricUnit } from '@/lib/format/stat'
import type { AssigneePickerOption } from '@/app/(admin)/admin/stats/actions'
import type { StatDivisionSummary } from '@/lib/services/stat-tracker-service'

const UNASSIGNED = '__unassigned__'

export interface MetricInitial {
  id: string
  name: string
  description: string | null
  divisionId: string
  unit: MetricUnit
  assignedToId: string | null
  targetValue: number | null
}

interface MetricDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  divisions: StatDivisionSummary[]
  assignees: AssigneePickerOption[]
  /** Present = edit mode. Absent = create mode. */
  initial?: MetricInitial
  defaultDivisionId?: string | null
}

export function MetricDialog({
  open,
  onOpenChange,
  divisions,
  assignees,
  initial,
  defaultDivisionId,
}: MetricDialogProps) {
  const isEdit = !!initial
  const initialDivisionId = initial?.divisionId ?? defaultDivisionId ?? ''

  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [divisionId, setDivisionId] = useState(initialDivisionId)
  const [assigneeId, setAssigneeId] = useState<string>(
    initial?.assignedToId ?? UNASSIGNED,
  )
  const [unit, setUnit] = useState<MetricUnit>(initial?.unit ?? 'COUNT')
  const [targetValue, setTargetValue] = useState(
    initial?.targetValue != null ? String(initial.targetValue) : '',
  )
  const [pending, startTransition] = useTransition()

  // Re-seed fields whenever a fresh open changes the target row.
  const [primedFor, setPrimedFor] = useState<string | null>(null)
  const targetKey = initial?.id ?? '__create__'
  if (open && primedFor !== targetKey) {
    setPrimedFor(targetKey)
    setName(initial?.name ?? '')
    setDescription(initial?.description ?? '')
    setDivisionId(initialDivisionId)
    setAssigneeId(initial?.assignedToId ?? UNASSIGNED)
    setUnit(initial?.unit ?? 'COUNT')
    setTargetValue(
      initial?.targetValue != null ? String(initial.targetValue) : '',
    )
  }
  if (!open && primedFor !== null) setPrimedFor(null)

  function reset() {
    if (isEdit) return // parent controls the target row; nothing to blank
    setName('')
    setDescription('')
    setDivisionId(defaultDivisionId ?? '')
    setAssigneeId(UNASSIGNED)
    setUnit('COUNT')
    setTargetValue('')
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  function handleSubmit() {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    if (!divisionId) {
      toast.error('Pick a group')
      return
    }
    const parsedTarget = targetValue.trim() ? Number(targetValue) : null
    if (parsedTarget !== null && !Number.isFinite(parsedTarget)) {
      toast.error('Target must be a number')
      return
    }
    startTransition(async () => {
      if (isEdit && initial) {
        const result = await updateMetricAction(initial.id, {
          name,
          description: description || null,
          divisionId,
          assignedToId: assigneeId === UNASSIGNED ? null : assigneeId,
          unit,
          targetValue: parsedTarget,
        })
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success('Metric updated')
        handleOpenChange(false)
      } else {
        const result = await createMetricAction({
          name,
          description: description || null,
          divisionId,
          assignedToId: assigneeId === UNASSIGNED ? null : assigneeId,
          unit,
          targetValue: parsedTarget,
        })
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success('Metric created')
        handleOpenChange(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit metric' : 'New metric'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update this metric. Recorded values stay attached even if you move the metric to another group.'
              : 'Create a KPI card. Only the assigned user can record values.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stat-metric-name">Name</Label>
            <Input
              id="stat-metric-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Instagram Followers"
              autoFocus
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="stat-metric-division">Group</Label>
              <Select
                value={divisionId}
                onValueChange={(v) => setDivisionId(v ?? '')}
              >
                <SelectTrigger id="stat-metric-division" className="w-full">
                  <SelectValue placeholder="Choose a group">
                    {(v: string) => {
                      if (!v) return 'Choose a group'
                      const d = divisions.find((x) => x.id === v)
                      if (!d) return 'Choose a group'
                      return d.shortLabel ? `${d.shortLabel} — ${d.name}` : d.name
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {divisions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.shortLabel ? `${d.shortLabel} — ${d.name}` : d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stat-metric-unit">Unit</Label>
              <Select
                value={unit}
                onValueChange={(v) => setUnit((v as MetricUnit) ?? 'COUNT')}
              >
                <SelectTrigger id="stat-metric-unit" className="w-full">
                  <SelectValue>
                    {(v: string) => unitLabel((v as MetricUnit) || 'COUNT')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COUNT">{unitLabel('COUNT')}</SelectItem>
                  <SelectItem value="CURRENCY">
                    {unitLabel('CURRENCY')}
                  </SelectItem>
                  <SelectItem value="PERCENT">
                    {unitLabel('PERCENT')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stat-metric-assignee">Assigned to</Label>
            <Select
              value={assigneeId}
              onValueChange={(v) => setAssigneeId(v ?? UNASSIGNED)}
            >
              <SelectTrigger id="stat-metric-assignee" className="w-full">
                <SelectValue>
                  {(v: string) => {
                    if (!v || v === UNASSIGNED) return 'Unassigned'
                    const a = assignees.find((x) => x.id === v)
                    return displayName(a) || 'Unassigned'
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                {assignees.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {displayName(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Only ADMIN and TEAM users can be assigned.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stat-metric-target">Target (optional)</Label>
            <Input
              id="stat-metric-target"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder="e.g. 10000"
              inputMode="decimal"
            />
            <p className="text-xs text-muted-foreground">
              Draws a dashed reference line on the chart.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stat-metric-desc">Description (optional)</Label>
            <Textarea
              id="stat-metric-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What does this measure?"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending
              ? isEdit
                ? 'Saving…'
                : 'Creating…'
              : isEdit
                ? 'Save changes'
                : 'Create metric'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function displayName(
  user: { name: string | null; email: string } | undefined,
): string {
  if (!user) return ''
  const name = user.name?.trim()
  if (name) return name
  return user.email.split('@')[0] ?? ''
}

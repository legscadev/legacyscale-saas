'use client'

import { useState, useTransition } from 'react'
import {
  Expand,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  User,
} from 'lucide-react'
import { toast } from 'sonner'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ManageValuesDialog } from './manage-values-dialog'
import { MetricChart } from './metric-chart'
import { MetricDetailDialog } from './metric-detail-dialog'
import { MetricDialog } from './metric-dialog'
import { deleteMetricAction } from '@/app/(admin)/admin/stats/actions'
import { formatMetricValue } from '@/lib/format/stat'
import type {
  AssigneePickerOption,
} from '@/app/(admin)/admin/stats/actions'
import type {
  StatDivisionSummary,
  StatMetricRow,
} from '@/lib/services/stat-tracker-service'

interface MetricCardProps {
  metric: StatMetricRow
  currentUserId: string
  currentUserIsAdmin: boolean
  divisions: StatDivisionSummary[]
  assignees: AssigneePickerOption[]
  /** When true (usually in "All groups" view) shows a small chip
   *  above the metric name so the reader knows which group it
   *  belongs to. Hidden by default when viewing a specific group. */
  showGroupBadge?: boolean
  /** ISO YYYY-MM-DD. When set, the chart + latest value only
   *  reflect points on or after this date. */
  fromDate?: string | null
  /** ISO YYYY-MM-DD. When set, the chart + latest value only
   *  reflect points on or before this date. */
  toDate?: string | null
  /** Human label for the currently selected date range, e.g.
   *  "today", "past 7 days", "YTD". Rendered next to the latest
   *  value so the reader can tell what the value represents. */
  rangeLabel?: string | null
}

export function MetricCard({
  metric,
  currentUserId,
  currentUserIsAdmin,
  divisions,
  assignees,
  showGroupBadge = false,
  fromDate = null,
  toDate = null,
  rangeLabel = null,
}: MetricCardProps) {
  const [managing, setManaging] = useState(false)
  const [expanding, setExpanding] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [pending, startTransition] = useTransition()

  // Only the assignee records values. When a metric is unassigned,
  // admins can fill in so the card doesn't sit blank forever.
  // Admins still get the kebab menu (Delete metric) regardless.
  const isAssignee = metric.assignedTo?.userId === currentUserId
  const isUnassignedAdmin = !metric.assignedTo && currentUserIsAdmin
  const canRecord = isAssignee || isUnassignedAdmin

  // Apply the page-level date range to this card's data. Points are
  // already ordered oldest → newest.
  const fromTime = fromDate ? new Date(fromDate).getTime() : null
  const toTime = toDate ? new Date(toDate + 'T23:59:59').getTime() : null
  const visiblePoints = metric.dataPoints.filter((p) => {
    const t = new Date(p.recordedAt).getTime()
    if (fromTime !== null && t < fromTime) return false
    if (toTime !== null && t > toTime) return false
    return true
  })
  const latestVisible = visiblePoints[visiblePoints.length - 1] ?? null

  // Big headline number:
  //   - With a range: totalize (SUM) for COUNT/CURRENCY units,
  //     average for PERCENT (a "% for a period" doesn't sum).
  //   - Without a range: use the latest recorded value.
  const rangeActive = fromTime !== null || toTime !== null
  const headlineValue: number | null =
    visiblePoints.length === 0
      ? null
      : rangeActive
        ? metric.unit === 'PERCENT'
          ? visiblePoints.reduce((s, p) => s + p.value, 0) /
            visiblePoints.length
          : visiblePoints.reduce((s, p) => s + p.value, 0)
        : (latestVisible?.value ?? null)

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteMetricAction(metric.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Metric deleted')
      setConfirmingDelete(false)
    })
  }

  return (
    <Card className="gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {showGroupBadge ? (
            <div className="mb-1 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {metric.division.shortLabel ?? metric.division.name}
            </div>
          ) : null}
          <h3 className="truncate text-sm font-semibold">{metric.name}</h3>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="size-3" />
            {metric.assignedTo?.name.trim() || 'Unassigned'}
          </div>
        </div>
        {/* One primary + one overflow. Keeps the header tidy no
            matter which role is looking. */}
        <div className="flex shrink-0 items-center gap-1">
          {canRecord ? (
            <Button
              size="icon-sm"
              aria-label="Manage values"
              onClick={() => setManaging(true)}
            >
              <Plus />
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Metric actions"
              render={
                <button
                  type="button"
                  className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                />
              }
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-44">
              <DropdownMenuItem onClick={() => setExpanding(true)}>
                <Expand className="size-4" />
                Expand
              </DropdownMenuItem>
              {currentUserIsAdmin ? (
                <>
                  <DropdownMenuItem onClick={() => setEditing(true)}>
                    <Pencil className="size-4" />
                    Edit metric
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setConfirmingDelete(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="size-4" />
                    Delete metric
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">
          {headlineValue != null
            ? formatMetricValue(headlineValue, metric.unit)
            : '—'}
        </span>
        {latestVisible ? (
          <span className="text-xs text-muted-foreground">
            {rangeActive
              ? (rangeLabel ?? 'in range') +
                (metric.unit === 'PERCENT' ? ' avg' : ' total')
              : (rangeLabel ?? formatRelativeShort(latestVisible.recordedAt))}
          </span>
        ) : null}
      </div>

      <MetricChart
        points={visiblePoints}
        unit={metric.unit}
        targetValue={metric.targetValue}
        canRecord={canRecord}
        assigneeName={
          metric.assignedTo?.name.trim() ||
          null
        }
        fromDate={fromDate}
        toDate={toDate}
      />

      <MetricDetailDialog
        open={expanding}
        onOpenChange={setExpanding}
        name={metric.name}
        description={metric.description}
        unit={metric.unit}
        targetValue={metric.targetValue}
        divisionLabel={
          metric.division.shortLabel ?? metric.division.name
        }
        assigneeName={
          metric.assignedTo?.name.trim() ||
          null
        }
        allPoints={metric.dataPoints}
        initialFromDate={fromDate}
        initialToDate={toDate}
      />

      <ManageValuesDialog
        open={managing}
        onOpenChange={setManaging}
        metricId={metric.id}
        metricName={metric.name}
        unit={metric.unit}
        dataPoints={metric.dataPoints}
        canDelete={canRecord}
      />

      <MetricDialog
        open={editing}
        onOpenChange={setEditing}
        divisions={divisions}
        assignees={assignees}
        initial={{
          id: metric.id,
          name: metric.name,
          description: metric.description,
          divisionId: metric.division.id,
          unit: metric.unit,
          assignedToId: metric.assignedTo?.id ?? null,
          targetValue: metric.targetValue,
        }}
      />

      <AlertDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this metric?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <strong>{metric.name}</strong> and
              every value recorded on it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pending ? 'Deleting…' : 'Delete metric'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function formatRelativeShort(date: Date): string {
  const now = Date.now()
  const then = new Date(date).getTime()
  const diff = now - then
  const day = 24 * 60 * 60 * 1000
  if (diff < day) return 'today'
  if (diff < 2 * day) return 'yesterday'
  const days = Math.round(diff / day)
  if (days < 7) return `${days}d ago`
  const weeks = Math.round(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  // Data points come from @db.Date columns stored at UTC midnight.
  // Render in UTC so a July 17 pick doesn't show as "Jul 16" to
  // viewers in negative UTC offsets (or positive, depending which
  // way the rounding falls at that instant).
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(date))
}

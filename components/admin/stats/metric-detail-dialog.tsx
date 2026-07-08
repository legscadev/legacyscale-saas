'use client'

import { useState } from 'react'
import { User } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { MetricChart } from './metric-chart'
import { formatMetricValue } from '@/lib/format/stat'
import type { MetricUnit } from '@/lib/format/stat'

interface MetricDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  description: string | null
  unit: MetricUnit
  targetValue: number | null
  divisionLabel: string
  assigneeName: string | null
  /** Every data point on the metric — the dialog re-filters
   *  independently so the range chosen here doesn't affect the
   *  card grid on the page behind. */
  allPoints: { id: string; value: number; recordedAt: Date; note: string | null }[]
  /** Range inherited from the page toolbar; users can override
   *  inside the modal. */
  initialFromDate: string | null
  initialToDate: string | null
}

/**
 * Full-height chart view of a single metric. Independent date-range
 * controls so a viewer can zoom in/out without disturbing the page-
 * level filter.
 */
export function MetricDetailDialog({
  open,
  onOpenChange,
  name,
  description,
  unit,
  targetValue,
  divisionLabel,
  assigneeName,
  allPoints,
  initialFromDate,
  initialToDate,
}: MetricDetailDialogProps) {
  const [fromDate, setFromDate] = useState<string>(initialFromDate ?? '')
  const [toDate, setToDate] = useState<string>(initialToDate ?? '')

  // Re-seed the modal's local range whenever a fresh open flips the
  // target metric so it always starts from the page's current range.
  const [primedFor, setPrimedFor] = useState<string | null>(null)
  const targetKey = `${initialFromDate ?? ''}|${initialToDate ?? ''}|${name}`
  if (open && primedFor !== targetKey) {
    setPrimedFor(targetKey)
    setFromDate(initialFromDate ?? '')
    setToDate(initialToDate ?? '')
  }
  if (!open && primedFor !== null) setPrimedFor(null)

  function applyToday() {
    const today = isoToday()
    setFromDate(today)
    setToDate(today)
  }
  function applyRange(days: number) {
    const to = new Date()
    const from = new Date()
    from.setDate(from.getDate() - days + 1)
    setFromDate(toIso(from))
    setToDate(toIso(to))
  }
  function applyYtd() {
    const now = new Date()
    setFromDate(`${now.getFullYear()}-01-01`)
    setToDate(toIso(now))
  }
  function clearRange() {
    setFromDate('')
    setToDate('')
  }

  const activePreset = matchPreset(fromDate, toDate)

  // Client-side filter — same rule as MetricCard.
  const fromTime = fromDate ? new Date(fromDate).getTime() : null
  const toTime = toDate ? new Date(toDate + 'T23:59:59').getTime() : null
  const visiblePoints = allPoints.filter((p) => {
    const t = new Date(p.recordedAt).getTime()
    if (fromTime !== null && t < fromTime) return false
    if (toTime !== null && t > toTime) return false
    return true
  })
  const latestVisible = visiblePoints[visiblePoints.length - 1] ?? null

  const rangeActive = fromTime !== null || toTime !== null
  const headlineValue: number | null =
    visiblePoints.length === 0
      ? null
      : rangeActive
        ? unit === 'PERCENT'
          ? visiblePoints.reduce((s, p) => s + p.value, 0) /
            visiblePoints.length
          : visiblePoints.reduce((s, p) => s + p.value, 0)
        : (latestVisible?.value ?? null)
  const headlineLabel = rangeActive
    ? unit === 'PERCENT'
      ? 'Average'
      : 'Total'
    : 'Latest'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-h-[90vh] flex-col sm:max-w-4xl">
        <DialogHeader className="shrink-0">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <span className="rounded bg-muted px-1.5 py-0.5">
              {divisionLabel}
            </span>
            <span className="flex items-center gap-1">
              <User className="size-3" />
              {assigneeName ?? 'Unassigned'}
            </span>
          </div>
          <DialogTitle className="text-xl">{name}</DialogTitle>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </DialogHeader>

        {/* Summary + range controls stay compact so the chart takes
            the rest of the modal. */}
        <div className="shrink-0 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryTile
              label={headlineLabel}
              value={
                headlineValue != null
                  ? formatMetricValue(headlineValue, unit)
                  : '—'
              }
            />
            <SummaryTile
              label="Points in range"
              value={String(visiblePoints.length)}
            />
            <SummaryTile
              label="Target"
              value={
                targetValue != null
                  ? formatMetricValue(targetValue, unit)
                  : '—'
              }
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Date range:</span>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              aria-label="From date"
              className="h-8 w-auto"
            />
            <span className="text-muted-foreground">→</span>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              aria-label="To date"
              className="h-8 w-auto"
            />
            <div className="flex items-center gap-1">
              <Chip
                label="Today"
                active={activePreset === 'today'}
                onClick={applyToday}
              />
              <Chip
                label="7d"
                active={activePreset === '7d'}
                onClick={() => applyRange(7)}
              />
              <Chip
                label="30d"
                active={activePreset === '30d'}
                onClick={() => applyRange(30)}
              />
              <Chip
                label="90d"
                active={activePreset === '90d'}
                onClick={() => applyRange(90)}
              />
              <Chip
                label="YTD"
                active={activePreset === 'ytd'}
                onClick={applyYtd}
              />
              {fromDate || toDate ? (
                <Chip label="Clear" onClick={clearRange} />
              ) : null}
            </div>
          </div>
        </div>

        {/* Chart fills all remaining vertical space. */}
        <div className="min-h-0 flex-1 rounded-lg border p-4">
          <MetricChart
            points={visiblePoints}
            unit={unit}
            targetValue={targetValue}
            canRecord={false}
            assigneeName={assigneeName}
            fromDate={fromDate || null}
            toDate={toDate || null}
            fillHeight
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface SummaryTileProps {
  label: string
  value: string
}

function SummaryTile({ label, value }: SummaryTileProps) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  )
}

interface ChipProps {
  label: string
  onClick: () => void
  active?: boolean
}

function Chip({ label, onClick, active = false }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ' +
        (active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground')
      }
    >
      {label}
    </button>
  )
}

type PresetKey = 'today' | '7d' | '30d' | '90d' | 'ytd' | null

function matchPreset(fromDate: string, toDate: string): PresetKey {
  if (!fromDate || !toDate) return null
  const today = isoToday()
  if (fromDate === today && toDate === today) return 'today'

  const ytdFrom = `${new Date().getFullYear()}-01-01`
  if (fromDate === ytdFrom && toDate === today) return 'ytd'

  const daysBack = (days: number): string => {
    const d = new Date()
    d.setDate(d.getDate() - days + 1)
    return toIso(d)
  }
  if (toDate === today && fromDate === daysBack(7)) return '7d'
  if (toDate === today && fromDate === daysBack(30)) return '30d'
  if (toDate === today && fromDate === daysBack(90)) return '90d'
  return null
}

function toIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isoToday(): string {
  return toIso(new Date())
}

'use client'

// Matrix editor for stats: metrics as rows, days of the selected
// month as columns. Bulk-entry friendly — walk down a column to
// fill in the day, or across a row to fill in a week.
//
// Auth mirrors the existing per-card record flow: admins can enter
// values on any metric; non-admins can only enter on metrics whose
// assigned Employee is linked to their User. Cells for metrics you
// can't edit render read-only (no border, no focus ring) but still
// show any recorded value so you can see the state of the team.
//
// Save semantics: each cell commits on blur (or Enter). Empty
// blur on an existing value deletes the data point; typed blur
// on an existing value upserts. Local state updates optimistically
// so the cell stays in sync even before the server round trip
// finishes; errors roll back and toast.

import { useCallback, useMemo, useState, useTransition } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { StatMetricRow } from '@/lib/services/stat-tracker-service'
import {
  deleteDataPointAction,
  upsertDataPointAction,
} from '@/app/(admin)/admin/stats/actions'

interface MetricsTableViewProps {
  metrics: StatMetricRow[]
  currentUserId: string
  currentUserIsAdmin: boolean
  /** Fires after any cell mutation succeeds so the shell can
   *  reconcile its own state (division counts, sparkline data). */
  onChanged?: () => void
}

/** All rendered rows key on the ISO date (YYYY-MM-DD) rather than
 *  a Date instance so the map cache surviving re-renders. */
type CellKey = `${string}:${string}` // `${metricId}:${isoDate}`

/** Local overlay map for optimistic writes. If a key is present,
 *  it wins over the value derived from the server payload. */
type Overlay = Map<CellKey, number | null>

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function toIsoDate(y: number, m0: number, d: number): string {
  // Local-date ISO (YYYY-MM-DD) — we're keying against calendar
  // days, not moments in time. No timezone conversion.
  const mm = String(m0 + 1).padStart(2, '0')
  const dd = String(d).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

function isoOfDataPoint(d: Date): string {
  return toIsoDate(d.getFullYear(), d.getMonth(), d.getDate())
}

function daysInMonth(y: number, m0: number): number {
  return new Date(y, m0 + 1, 0).getDate()
}

export function MetricsTableView({
  metrics,
  currentUserId,
  currentUserIsAdmin,
  onChanged,
}: MetricsTableViewProps) {
  const now = new Date()
  const [month, setMonth] = useState<{ year: number; month: number }>({
    year: now.getFullYear(),
    month: now.getMonth(),
  })
  const [overlay, setOverlay] = useState<Overlay>(new Map())
  const [, startSave] = useTransition()

  const dayCount = daysInMonth(month.year, month.month)
  const monthLabel = `${MONTH_NAMES[month.month]} ${month.year}`

  const goPrevMonth = () => {
    setMonth((prev) => {
      const m = prev.month - 1
      return m < 0
        ? { year: prev.year - 1, month: 11 }
        : { year: prev.year, month: m }
    })
  }
  const goNextMonth = () => {
    setMonth((prev) => {
      const m = prev.month + 1
      return m > 11
        ? { year: prev.year + 1, month: 0 }
        : { year: prev.year, month: m }
    })
  }
  const goToday = () => {
    const d = new Date()
    setMonth({ year: d.getFullYear(), month: d.getMonth() })
  }

  // Build a lookup for each metric's recorded values in the current
  // month. Empty when the fetch window didn't reach far enough back
  // — that's fine, cells just render blank and any new entry saves
  // fresh.
  const valuesByMetric = useMemo(() => {
    const out = new Map<string, Map<string, number>>()
    for (const m of metrics) {
      const perDay = new Map<string, number>()
      for (const p of m.dataPoints) {
        const iso = isoOfDataPoint(p.recordedAt)
        if (
          p.recordedAt.getFullYear() === month.year &&
          p.recordedAt.getMonth() === month.month
        ) {
          perDay.set(iso, p.value)
        }
      }
      out.set(m.id, perDay)
    }
    return out
  }, [metrics, month.year, month.month])

  const canEditMetric = useCallback(
    (m: StatMetricRow): boolean => {
      if (currentUserIsAdmin) return true
      return m.assignedTo?.userId === currentUserId
    },
    [currentUserId, currentUserIsAdmin],
  )

  const readCell = useCallback(
    (metricId: string, iso: string): number | null => {
      const key: CellKey = `${metricId}:${iso}`
      if (overlay.has(key)) return overlay.get(key)!
      return valuesByMetric.get(metricId)?.get(iso) ?? null
    },
    [overlay, valuesByMetric],
  )

  const setOverlayCell = useCallback(
    (metricId: string, iso: string, value: number | null) => {
      setOverlay((prev) => {
        const next = new Map(prev)
        next.set(`${metricId}:${iso}`, value)
        return next
      })
    },
    [],
  )

  const commit = useCallback(
    async (metricId: string, iso: string, next: number | null) => {
      const before = readCell(metricId, iso)
      if (next === before) return

      setOverlayCell(metricId, iso, next)
      startSave(async () => {
        const res =
          next === null
            ? await deleteExistingIfAny(metricId, iso, metrics)
            : await upsertDataPointAction({
                metricId,
                recordedAt: iso,
                value: next,
              })
        if (!res.ok) {
          toast.error(res.error ?? 'Could not save')
          setOverlayCell(metricId, iso, before)
          return
        }
        onChanged?.()
      })
    },
    [metrics, onChanged, readCell, setOverlayCell],
  )

  if (metrics.length === 0) return null

  const days = Array.from({ length: dayCount }, (_, i) => i + 1)
  const todayIso = toIsoDate(now.getFullYear(), now.getMonth(), now.getDate())

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={goPrevMonth}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[10rem] px-2 text-sm font-medium">
            {monthLabel}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={goNextMonth}
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={goToday}
            className="ml-1 text-xs"
          >
            Today
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Click a cell to record a value. Empty out a cell to delete.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-20 min-w-[16rem] border-b bg-muted/40 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Metric
              </th>
              {days.map((d) => {
                const iso = toIsoDate(month.year, month.month, d)
                const isToday = iso === todayIso
                return (
                  <th
                    key={d}
                    scope="col"
                    className={cn(
                      'min-w-16 border-b px-1 py-2 text-center text-[11px] font-semibold text-muted-foreground',
                      isToday && 'bg-primary/10 text-primary',
                    )}
                  >
                    {d}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => {
              const editable = canEditMetric(m)
              return (
                <tr key={m.id} className="group border-b last:border-0">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 min-w-[16rem] border-r bg-card px-3 py-2 text-left font-normal group-hover:bg-muted"
                  >
                    <div className="flex flex-col">
                      <span className="truncate text-sm font-medium">
                        {m.name}
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {m.division.shortLabel ?? m.division.name}
                        {' · '}
                        {m.assignedTo ? m.assignedTo.name : 'Unassigned'}
                      </span>
                    </div>
                  </th>
                  {days.map((d) => {
                    const iso = toIsoDate(month.year, month.month, d)
                    const value = readCell(m.id, iso)
                    return (
                      <td
                        key={d}
                        className="border-r p-0 text-center last:border-r-0"
                      >
                        <MetricCell
                          value={value}
                          disabled={!editable}
                          onCommit={(next) => commit(m.id, iso, next)}
                        />
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================
// Cell — controlled draft + commit-on-blur
// ============================================

interface MetricCellProps {
  value: number | null
  disabled: boolean
  onCommit: (next: number | null) => void
}

function MetricCell({ value, disabled, onCommit }: MetricCellProps) {
  // Uncontrolled draft: local state tracks the input the user is
  // typing; the "value" prop drives the initial + reset state.
  // Reset when the prop changes (e.g. optimistic rollback).
  const [draft, setDraft] = useState<string>(value === null ? '' : String(value))
  const [propValue, setPropValue] = useState<number | null>(value)
  if (value !== propValue) {
    // The prop has changed since our last render — sync the draft
    // once. This isn't the derived-state anti-pattern because the
    // draft is the source of truth for what the user has typed;
    // we only accept the prop change when it doesn't match ours.
    setPropValue(value)
    setDraft(value === null ? '' : String(value))
  }

  function handleBlur() {
    const trimmed = draft.trim()
    if (trimmed === '') {
      onCommit(null)
      return
    }
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed)) {
      setDraft(value === null ? '' : String(value))
      return
    }
    onCommit(parsed)
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      setDraft(value === null ? '' : String(value))
      e.currentTarget.blur()
    }
  }

  if (disabled) {
    return (
      <div
        aria-label="Read-only cell"
        className="h-9 min-w-16 whitespace-nowrap px-2 py-2 text-center text-xs text-muted-foreground/70"
      >
        {value === null ? '—' : value}
      </div>
    )
  }

  // field-sizing: content lets the input auto-grow to fit its value
  // (Chrome/Safari/Firefox all support it in 2026). min-w-16 keeps
  // empty cells legible at ~64px; the widest input in a column
  // pushes the whole column wider so values never render clipped
  // to something like "XX" for a 1234.56 entry. The table wrapper
  // already has overflow-x-auto, so wide months scroll horizontally.
  return (
    <input
      type="number"
      inputMode="decimal"
      step="any"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKey}
      className={cn(
        'h-9 min-w-16 border-0 bg-transparent px-2 text-center text-sm tabular-nums outline-none [field-sizing:content]',
        'focus:bg-primary/5 focus:ring-2 focus:ring-inset focus:ring-primary/40',
        '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
      )}
    />
  )
}

/** Delete lookup helper — find the point for (metric, iso) and
 *  call the delete action. Returns the same shape as upsert so the
 *  commit handler can uniformly branch on result.ok. */
async function deleteExistingIfAny(
  metricId: string,
  iso: string,
  metrics: StatMetricRow[],
): Promise<{ ok: true; id?: string } | { ok: false; error: string }> {
  const metric = metrics.find((m) => m.id === metricId)
  if (!metric) return { ok: false, error: 'Metric not found' }
  const target = metric.dataPoints.find(
    (p) => isoOfDataPoint(p.recordedAt) === iso,
  )
  if (!target) return { ok: true } // nothing to delete
  return deleteDataPointAction(target.id)
}

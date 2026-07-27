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

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { StatMetricRow } from '@/lib/services/stat-tracker-service'
import {
  deleteDataPointAction,
  fetchMonthDataPointsAction,
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
  // recordedAt is a @db.Date — Prisma hands it back as UTC midnight.
  // Read the calendar date in UTC (not local) so the cell key matches
  // the date we wrote regardless of the viewer's timezone.
  return toIsoDate(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/** metricId → iso → recorded point, for the visible month. */
type MonthMap = Map<string, Map<string, { id: string; value: number }>>

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

  // Data points for the visible month, fetched on demand. The initial
  // page payload only carries the most-recent take-N points per
  // metric, so any month older than that window (e.g. January viewed
  // in July) is absent there — this range fetch is what makes those
  // months render and persist correctly.
  const [monthData, setMonthData] = useState<MonthMap>(new Map())
  // True while the visible month's points are in flight — drives the
  // table's loading overlay so switching months shows progress instead
  // of stale cells snapping to new values. Starts false: the initial
  // mount already has the current month's data from the page payload,
  // so we reconcile it silently and only show the overlay on an
  // actual month change.
  const [monthLoading, setMonthLoading] = useState(false)
  const monthReqRef = useRef(0)
  const firstMonthRun = useRef(true)

  useEffect(() => {
    const reqId = ++monthReqRef.current
    if (firstMonthRun.current) {
      firstMonthRun.current = false
    } else {
      setMonthLoading(true)
    }
    fetchMonthDataPointsAction(month.year, month.month + 1).then((res) => {
      // Ignore a stale response if the operator moved to another month.
      if (reqId !== monthReqRef.current) return
      if (!res.ok) {
        toast.error(res.error ?? 'Could not load this month')
        setMonthLoading(false)
        return
      }
      const map: MonthMap = new Map()
      for (const p of res.points) {
        const iso = isoOfDataPoint(p.recordedAt)
        let perMetric = map.get(p.metricId)
        if (!perMetric) {
          perMetric = new Map()
          map.set(p.metricId, perMetric)
        }
        perMetric.set(iso, { id: p.id, value: p.value })
      }
      setMonthData(map)
      // Authoritative data arrived — drop optimistic overlays so the
      // two don't diverge.
      setOverlay(new Map())
      setMonthLoading(false)
    })
  }, [month.year, month.month])

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
      // overlay (optimistic) > monthData (authoritative for the visible
      // month) > the capped initial payload (fallback before the month
      // fetch resolves, mostly the current month).
      if (overlay.has(key)) return overlay.get(key)!
      const fromMonth = monthData.get(metricId)?.get(iso)
      if (fromMonth) return fromMonth.value
      return valuesByMetric.get(metricId)?.get(iso) ?? null
    },
    [overlay, monthData, valuesByMetric],
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

  const clearOverlayCell = useCallback((metricId: string, iso: string) => {
    setOverlay((prev) => {
      if (!prev.has(`${metricId}:${iso}`)) return prev
      const next = new Map(prev)
      next.delete(`${metricId}:${iso}`)
      return next
    })
  }, [])

  const commit = useCallback(
    async (metricId: string, iso: string, next: number | null) => {
      const before = readCell(metricId, iso)
      if (next === before) return

      setOverlayCell(metricId, iso, next)
      startSave(async () => {
        let res: { ok: true; id?: string } | { ok: false; error: string }
        if (next === null) {
          // Delete: prefer the id we already hold for this month; fall
          // back to scanning the (capped) initial payload.
          const existing = monthData.get(metricId)?.get(iso)
          res = existing
            ? await deleteDataPointAction(existing.id)
            : await deleteExistingIfAny(metricId, iso, metrics)
        } else {
          res = await upsertDataPointAction({
            metricId,
            recordedAt: iso,
            value: next,
          })
        }

        if (!res.ok) {
          toast.error(res.error ?? 'Could not save')
          setOverlayCell(metricId, iso, before)
          return
        }

        // Reconcile the authoritative month map, then drop the overlay
        // so the cell reads straight from persisted state.
        const savedId = 'id' in res ? res.id : undefined
        setMonthData((prev) => {
          const nextMap: MonthMap = new Map(prev)
          const perMetric = new Map(nextMap.get(metricId) ?? [])
          if (next === null) {
            perMetric.delete(iso)
          } else {
            perMetric.set(iso, {
              id: savedId ?? perMetric.get(iso)?.id ?? '',
              value: next,
            })
          }
          nextMap.set(metricId, perMetric)
          return nextMap
        })
        clearOverlayCell(metricId, iso)
        onChanged?.()
      })
    },
    [metrics, monthData, onChanged, readCell, setOverlayCell, clearOverlayCell],
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
          <span className="flex min-w-[10rem] items-center gap-1.5 px-2 text-sm font-medium">
            {monthLabel}
            {monthLoading ? (
              <Loader2
                className="size-3.5 animate-spin text-muted-foreground"
                aria-label="Loading month"
              />
            ) : null}
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

      <div className="relative overflow-x-auto rounded-lg border bg-card">
        {monthLoading ? (
          <div
            className="pointer-events-none absolute inset-0 z-30 flex items-start justify-center bg-card/60 backdrop-blur-[1px]"
            aria-hidden
          >
            <div className="mt-16 flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
              <Loader2 className="size-3.5 animate-spin" />
              Loading {monthLabel}…
            </div>
          </div>
        ) : null}
        <table
          aria-busy={monthLoading}
          className={cn(
            'min-w-full border-collapse text-sm transition-opacity',
            monthLoading && 'opacity-50',
          )}
        >
          <thead className="bg-muted">
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-20 min-w-[16rem] border-b bg-muted px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
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

'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

import {
  saveEntry,
  saveTargets,
  type DailyEntry,
  type MonthlyTargets,
} from '@/app/(admin)/admin/production-sheets/actions'
import {
  CURRENCY_METRICS,
  METRIC_KEYS,
  METRIC_LABELS,
  daysInMonth,
  daysLeftInMonth,
  type MetricKey,
} from '@/lib/production/metrics'

interface DailyEntryGridProps {
  userId: string
  year: number
  month: number
  entries: DailyEntry[]
  targets: MonthlyTargets
  loading: boolean
  /** True when the grid is showing an aggregate (e.g. "All users").
   *  Renders read-only — inputs become static text so admins can't
   *  accidentally try to write to a summed row. */
  readOnly?: boolean
  onEntriesChange: (entries: DailyEntry[]) => void
  onTargetsChange: (targets: MonthlyTargets) => void
}

const CURRENCY_FMT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

const NUMBER_FMT = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
})

function formatMetric(key: MetricKey, value: number): string {
  if (value === 0) return '—'
  return CURRENCY_METRICS.has(key) ? CURRENCY_FMT.format(value) : NUMBER_FMT.format(value)
}

function parseNumeric(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  if (Number.isNaN(n)) return null
  return n
}

/**
 * Editable day × metric grid. Cell edits save on blur so we don't
 * fire a write per keystroke; the sheet-wide totals + run-rate row
 * recompute locally from the same state so the numbers stay in sync
 * even before the server round-trip.
 */
export function DailyEntryGrid({
  userId,
  year,
  month,
  entries,
  targets,
  loading,
  readOnly = false,
  onEntriesChange,
  onTargetsChange,
}: DailyEntryGridProps) {
  const [savingCell, setSavingCell] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const totals = useMemo(() => {
    const acc: Record<MetricKey, number> = {
      phoneCalls: 0, dms: 0, cellConnects: 0, appointmentsSet: 0,
      demosConducted: 0, introUnits: 0, basisUnits: 0, majorUnits: 0,
      sales: 0, collections: 0,
    }
    for (const e of entries) {
      for (const k of METRIC_KEYS) acc[k] += Number(e[k] ?? 0)
    }
    return acc
  }, [entries])

  const totalDays = daysInMonth(year, month)
  const daysLeft = daysLeftInMonth(year, month)
  const daysElapsed = Math.max(totalDays - daysLeft, 1)

  const runRate = useMemo(() => {
    const rate: Record<MetricKey, number> = { ...totals }
    for (const k of METRIC_KEYS) {
      rate[k] = (totals[k] / daysElapsed) * totalDays
    }
    return rate
  }, [totals, daysElapsed, totalDays])

  const remaining = useMemo(() => {
    const rem: Partial<Record<MetricKey, number>> = {}
    for (const k of METRIC_KEYS) {
      const target = targets[k] ?? 0
      rem[k] = Math.max(target - totals[k], 0)
    }
    return rem
  }, [totals, targets])

  const commitCell = (
    date: string,
    key: MetricKey,
    rawValue: string,
    notesOverride?: string,
  ) => {
    const parsed = parseNumeric(rawValue)
    const existing = entries.find((e) => e.date === date)
    if (existing) {
      // No-op fast path: nothing changed for this cell.
      if (existing[key] === parsed && notesOverride === undefined) return
    }
    const next = entries.map((e) =>
      e.date === date
        ? { ...e, [key]: parsed, ...(notesOverride !== undefined ? { notes: notesOverride } : {}) }
        : e,
    )
    onEntriesChange(next)
    const merged = next.find((e) => e.date === date)!
    const cellId = `${date}:${key}`
    setSavingCell(cellId)
    startTransition(async () => {
      const result = await saveEntry({
        userId,
        date,
        phoneCalls: merged.phoneCalls,
        dms: merged.dms,
        cellConnects: merged.cellConnects,
        appointmentsSet: merged.appointmentsSet,
        demosConducted: merged.demosConducted,
        introUnits: merged.introUnits,
        basisUnits: merged.basisUnits,
        majorUnits: merged.majorUnits,
        sales: merged.sales,
        collections: merged.collections,
        notes: merged.notes,
      })
      setSavingCell(null)
      if (!result.ok) {
        toast.error(result.error)
      }
    })
  }

  const commitNote = (date: string, note: string) => {
    const existing = entries.find((e) => e.date === date)
    if ((existing?.notes ?? '') === note) return
    commitCell(date, 'notes' as unknown as MetricKey, '', note)
  }

  const commitTarget = (key: MetricKey, raw: string) => {
    const parsed = parseNumeric(raw)
    if ((targets[key] ?? null) === parsed) return
    const next = { ...targets, [key]: parsed }
    onTargetsChange(next)
    startTransition(async () => {
      const result = await saveTargets({
        userId,
        year,
        month,
        phoneCalls: next.phoneCalls,
        dms: next.dms,
        cellConnects: next.cellConnects,
        appointmentsSet: next.appointmentsSet,
        demosConducted: next.demosConducted,
        introUnits: next.introUnits,
        basisUnits: next.basisUnits,
        majorUnits: next.majorUnits,
        sales: next.sales,
        collections: next.collections,
      })
      if (!result.ok) toast.error(result.error)
    })
  }

  return (
    <div className={cn('rounded-lg border', loading && 'opacity-60')}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 min-w-24 bg-muted">Date</TableHead>
              {METRIC_KEYS.map((k) => (
                <TableHead key={k} className="min-w-24 whitespace-nowrap text-right">
                  {METRIC_LABELS[k]}
                </TableHead>
              ))}
              <TableHead className="min-w-40">Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => {
              const dateLabel = new Date(`${entry.date}T00:00:00Z`).toLocaleDateString(
                'en-US',
                { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' },
              )
              return (
                <TableRow key={entry.date}>
                  <TableCell className="sticky left-0 z-10 whitespace-nowrap bg-background font-medium">
                    {dateLabel}
                  </TableCell>
                  {METRIC_KEYS.map((k) => {
                    const cellId = `${entry.date}:${k}`
                    const value = entry[k]
                    if (readOnly) {
                      return (
                        <TableCell
                          key={k}
                          className="text-right tabular-nums text-muted-foreground"
                        >
                          {value === null || value === 0
                            ? '—'
                            : formatMetric(k, Number(value))}
                        </TableCell>
                      )
                    }
                    return (
                      <TableCell key={k} className="p-1">
                        <Input
                          type="number"
                          inputMode="decimal"
                          step={CURRENCY_METRICS.has(k) ? '0.01' : '1'}
                          defaultValue={value ?? ''}
                          onBlur={(e) => commitCell(entry.date, k, e.target.value)}
                          className={cn(
                            'h-8 text-right tabular-nums [field-sizing:content] min-w-16',
                            savingCell === cellId && 'ring-1 ring-primary',
                          )}
                        />
                      </TableCell>
                    )
                  })}
                  <TableCell className="p-1">
                    {readOnly ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <Input
                        defaultValue={entry.notes ?? ''}
                        onBlur={(e) => commitNote(entry.date, e.target.value)}
                        className="h-8 min-w-40"
                        placeholder="—"
                      />
                    )}
                  </TableCell>
                </TableRow>
              )
            })}

            {/* Totals */}
            <TableRow className="border-t-2 bg-muted/40 font-medium">
              <TableCell className="sticky left-0 z-10 bg-muted">Total</TableCell>
              {METRIC_KEYS.map((k) => (
                <TableCell key={k} className="text-right tabular-nums">
                  {formatMetric(k, totals[k])}
                </TableCell>
              ))}
              <TableCell />
            </TableRow>

            {/* Targets — editable (read-only in aggregate mode) */}
            <TableRow className="bg-muted/20">
              <TableCell className="sticky left-0 z-10 bg-muted font-medium">Target</TableCell>
              {METRIC_KEYS.map((k) => {
                if (readOnly) {
                  const value = targets[k]
                  return (
                    <TableCell
                      key={k}
                      className="text-right tabular-nums text-muted-foreground"
                    >
                      {value === null || value === 0
                        ? '—'
                        : formatMetric(k, Number(value))}
                    </TableCell>
                  )
                }
                return (
                  <TableCell key={k} className="p-1">
                    <Input
                      type="number"
                      inputMode="decimal"
                      step={CURRENCY_METRICS.has(k) ? '0.01' : '1'}
                      defaultValue={targets[k] ?? ''}
                      onBlur={(e) => commitTarget(k, e.target.value)}
                      className="h-8 text-right tabular-nums [field-sizing:content] min-w-16"
                      placeholder="—"
                      key={`${targets.id ?? 'new'}:${year}-${month}:${k}`}
                    />
                  </TableCell>
                )
              })}
              <TableCell />
            </TableRow>

            {/* Remaining */}
            <TableRow className="bg-muted/20 text-sm">
              <TableCell className="sticky left-0 z-10 bg-muted font-medium">Remaining</TableCell>
              {METRIC_KEYS.map((k) => (
                <TableCell key={k} className="text-right tabular-nums text-muted-foreground">
                  {formatMetric(k, remaining[k] ?? 0)}
                </TableCell>
              ))}
              <TableCell className="text-right text-xs text-muted-foreground">
                {daysLeft} day{daysLeft === 1 ? '' : 's'} left
              </TableCell>
            </TableRow>

            {/* Run rate */}
            <TableRow className="bg-muted/20 text-sm">
              <TableCell className="sticky left-0 z-10 bg-muted font-medium">Run Rate</TableCell>
              {METRIC_KEYS.map((k) => (
                <TableCell key={k} className="text-right tabular-nums text-muted-foreground">
                  {formatMetric(k, runRate[k])}
                </TableCell>
              ))}
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

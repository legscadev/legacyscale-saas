'use client'

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { formatMetricValue, type MetricUnit } from '@/lib/format/stat'

interface MetricChartProps {
  points: { recordedAt: Date; value: number }[]
  unit: MetricUnit
  targetValue: number | null
  /** Empty-state copy branches on this — a viewer without record
   *  access shouldn't be told to click a button they don't have. */
  canRecord?: boolean
  /** Optional display name of the metric's owner. Used in the
   *  read-only empty state to explain who's expected to fill in. */
  assigneeName?: string | null
  /** ISO YYYY-MM-DD bounds for the visible date range. When set,
   *  the X-axis spans this window even if the data set only
   *  covers part of it — clicking wider presets visibly zooms
   *  out. When null, the X-axis auto-fits the data. */
  fromDate?: string | null
  toDate?: string | null
  /** When true, the chart fills its parent's height instead of the
   *  card-default 160px. Used inside the expand-detail dialog. */
  fillHeight?: boolean
}

/**
 * Compact line chart for a single metric card. Assumes points come
 * in chronological order (oldest → newest). Renders empty-state
 * when there's nothing to plot yet.
 */
export function MetricChart({
  points,
  unit,
  targetValue,
  canRecord = false,
  assigneeName = null,
  fromDate = null,
  toDate = null,
  fillHeight = false,
}: MetricChartProps) {
  if (points.length === 0) {
    const emptyCopy = canRecord
      ? 'No values yet — click + to record the first one.'
      : assigneeName
        ? `No values yet — ${assigneeName} hasn't recorded any.`
        : 'No values yet.'
    return (
      <div
        className={
          'grid place-items-center rounded-md border border-dashed bg-muted/20 text-xs text-muted-foreground ' +
          (fillHeight ? 'h-full' : 'h-40')
        }
      >
        {emptyCopy}
      </div>
    )
  }

  // Use timestamps for x so the axis can span the whole selected
  // range even when the data covers only part of it (widening the
  // range visibly zooms out, not just shifts).
  const data = points.map((p) => ({
    x: new Date(p.recordedAt).getTime(),
    value: p.value,
    fullDate: p.recordedAt,
  }))

  const domain = computeDomain(data, fromDate, toDate)
  const axisConfig = buildAxisConfig(domain[0], domain[1])

  // Key the chart on the domain (not the data) so a filtered range
  // mounts a fresh chart even when the visible data set is the
  // same size — otherwise widening the range with no additional
  // points would leave the previous chart in place. Recharts holds
  // onto stale dimensions when props change without a remount.
  const chartKey = `${domain[0]}-${domain[1]}`

  return (
    <div className={fillHeight ? 'h-full w-full' : 'h-40 w-full'}>
      <ResponsiveContainer key={chartKey} width="100%" height="100%" minWidth={0}>
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
          <XAxis
            dataKey="x"
            type="number"
            scale="time"
            domain={domain}
            ticks={axisConfig.ticks}
            tick={{ fontSize: 10, fill: 'currentColor', fillOpacity: 0.6 }}
            tickLine={false}
            axisLine={false}
            minTickGap={20}
            tickFormatter={(ts: number) => axisConfig.formatTick(ts)}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'currentColor', fillOpacity: 0.6 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => formatMetricValue(v, unit, { compact: true })}
            width={36}
          />
          <Tooltip
            cursor={{ strokeOpacity: 0.15 }}
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload as
                | { fullDate: Date }
                | undefined
              // Always render the tooltip with the full long-form date
              // regardless of axis granularity — the mouse-target is
              // one specific point, precision helps.
              return row ? formatLongDate(row.fullDate) : ''
            }}
            formatter={(v) => [
              typeof v === 'number' ? formatMetricValue(v, unit) : '—',
              'Value',
            ]}
          />
          {targetValue != null ? (
            <ReferenceLine
              y={targetValue}
              stroke="var(--brand-500)"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
              label={{
                value: `Target ${formatMetricValue(targetValue, unit, { compact: true })}`,
                position: 'insideTopRight',
                fill: 'var(--brand-500)',
                fontSize: 10,
              }}
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--brand-500, #d11a1a)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--brand-500, #d11a1a)' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

interface AxisConfig {
  ticks: number[]
  formatTick: (ts: number) => string
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Choose a sensible tick series + label format based on how wide
 * the visible domain is. Buckets:
 *   ≤ 1 day       → hourly ticks (Ha)
 *   ≤ 14 days     → daily ticks (Mon 9)
 *   ≤ 90 days     → weekly ticks (Jul 9)
 *   ≤ 400 days    → monthly ticks (Jul)
 *   > 400 days    → yearly ticks (2026)
 * Ticks are always aligned to the natural boundary of that unit so
 * the axis reads cleanly (e.g. months start on the 1st).
 */
function buildAxisConfig(fromTs: number, toTs: number): AxisConfig {
  const spanDays = Math.max(1, Math.round((toTs - fromTs) / DAY_MS))

  if (spanDays <= 1) {
    return {
      ticks: alignedTicks(fromTs, toTs, 'hour', 3),
      formatTick: (ts) =>
        new Intl.DateTimeFormat('en-US', {
          hour: 'numeric',
        }).format(new Date(ts)),
    }
  }
  if (spanDays <= 14) {
    return {
      ticks: alignedTicks(fromTs, toTs, 'day', 1),
      formatTick: (ts) =>
        new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        }).format(new Date(ts)),
    }
  }
  if (spanDays <= 90) {
    return {
      ticks: alignedTicks(fromTs, toTs, 'day', 7),
      formatTick: (ts) =>
        new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        }).format(new Date(ts)),
    }
  }
  if (spanDays <= 400) {
    return {
      ticks: alignedTicks(fromTs, toTs, 'month', 1),
      formatTick: (ts) =>
        new Intl.DateTimeFormat('en-US', {
          month: 'short',
          timeZone: 'UTC',
        }).format(new Date(ts)),
    }
  }
  return {
    ticks: alignedTicks(fromTs, toTs, 'year', 1),
    formatTick: (ts) => String(new Date(ts).getUTCFullYear()),
  }
}

function alignedTicks(
  fromTs: number,
  toTs: number,
  unit: 'hour' | 'day' | 'month' | 'year',
  step: number,
): number[] {
  const ticks: number[] = []
  const cursor = new Date(fromTs)
  // Snap the cursor forward to the next natural UTC boundary so
  // the labeled tick sits on a clean unit (start-of-hour /
  // midnight-UTC / 1st-of-month / Jan 1). Working in UTC keeps
  // the tick positions aligned with the tick labels, which are
  // also rendered in UTC — data points on this chart come from
  // @db.Date columns that store calendar days as UTC midnight.
  if (unit === 'hour') {
    cursor.setUTCMinutes(0, 0, 0)
    if (cursor.getTime() < fromTs) cursor.setUTCHours(cursor.getUTCHours() + 1)
  } else if (unit === 'day') {
    cursor.setUTCHours(0, 0, 0, 0)
    if (cursor.getTime() < fromTs) cursor.setUTCDate(cursor.getUTCDate() + 1)
  } else if (unit === 'month') {
    cursor.setUTCDate(1)
    cursor.setUTCHours(0, 0, 0, 0)
    if (cursor.getTime() < fromTs) cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  } else {
    cursor.setUTCMonth(0, 1)
    cursor.setUTCHours(0, 0, 0, 0)
    if (cursor.getTime() < fromTs) cursor.setUTCFullYear(cursor.getUTCFullYear() + 1)
  }

  while (cursor.getTime() <= toTs) {
    ticks.push(cursor.getTime())
    if (unit === 'hour') cursor.setUTCHours(cursor.getUTCHours() + step)
    else if (unit === 'day') cursor.setUTCDate(cursor.getUTCDate() + step)
    else if (unit === 'month') cursor.setUTCMonth(cursor.getUTCMonth() + step)
    else cursor.setUTCFullYear(cursor.getUTCFullYear() + step)
    // Safety cap so a mis-typed range can't produce a runaway list.
    if (ticks.length > 60) break
  }
  return ticks
}

function computeDomain(
  data: { x: number }[],
  fromDate: string | null,
  toDate: string | null,
): [number, number] {
  // Prefer the explicit filter range when either bound is set —
  // that's what makes widening presets visibly zoom the axis.
  const explicit: [number | null, number | null] = [
    fromDate ? new Date(fromDate + 'T00:00:00').getTime() : null,
    toDate ? new Date(toDate + 'T23:59:59').getTime() : null,
  ]
  if (explicit[0] !== null || explicit[1] !== null) {
    const fromTs = explicit[0] ?? Math.min(...data.map((d) => d.x))
    const toTs = explicit[1] ?? Math.max(...data.map((d) => d.x))
    // If the range collapsed to a single day (Today preset), pad
    // so the point isn't glued to the left edge.
    if (fromTs === toTs) {
      const half = 12 * 60 * 60 * 1000
      return [fromTs - half, toTs + half]
    }
    return [fromTs, toTs]
  }
  if (data.length === 0) {
    const now = Date.now()
    return [now - 86_400_000, now]
  }
  const xs = data.map((d) => d.x)
  return [Math.min(...xs), Math.max(...xs)]
}

function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    // Data points come from @db.Date columns stored at UTC midnight.
    // Render in UTC so viewers in negative offsets don't see the
    // previous day.
    timeZone: 'UTC',
  }).format(new Date(date))
}

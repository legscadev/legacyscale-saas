'use client'

import { useState } from 'react'
import { BarChart3, Table as TableIcon } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

import {
  CURRENCY_METRICS,
  METRIC_KEYS,
  METRIC_LABELS,
  type MetricKey,
} from '@/lib/production/metrics'
import type { MonthlyAggregateRow } from '@/app/(admin)/admin/production-sheets/actions'

interface MasterDataViewProps {
  aggregates: MonthlyAggregateRow[]
  loading: boolean
}

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const CURRENCY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})
const NUMBER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

function fmt(key: MetricKey, value: number): string {
  if (value === 0) return '—'
  return CURRENCY_METRICS.has(key) ? CURRENCY.format(value) : NUMBER.format(value)
}

type View = 'table' | 'charts'

/**
 * "Master Data" tab: 12-month rollup table + phone-calls / DMs bar
 * charts (matching the two summary charts in the source spreadsheet).
 * Table and charts render on separate sub-views, toggled by the
 * button pair at the top — keeps the tab from feeling overwhelming
 * on a smaller screen.
 */
export function MasterDataView({ aggregates, loading }: MasterDataViewProps) {
  const [view, setView] = useState<View>('table')

  return (
    <div className={cn('flex flex-col gap-4', loading && 'opacity-60')}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Master Data</h2>
          <p className="text-sm text-muted-foreground">
            12-month rollup of every daily entry.
          </p>
        </div>
        <div className="inline-flex items-center rounded-md border bg-muted p-0.5">
          <Button
            size="sm"
            variant={view === 'table' ? 'default' : 'ghost'}
            onClick={() => setView('table')}
            className="h-8 gap-1.5"
          >
            <TableIcon className="h-3.5 w-3.5" />
            Table
          </Button>
          <Button
            size="sm"
            variant={view === 'charts' ? 'default' : 'ghost'}
            onClick={() => setView('charts')}
            className="h-8 gap-1.5"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Charts
          </Button>
        </div>
      </div>

      {view === 'table' ? <MasterTable aggregates={aggregates} /> : <MasterCharts aggregates={aggregates} />}
    </div>
  )
}

function MasterTable({ aggregates }: { aggregates: MonthlyAggregateRow[] }) {
  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 bg-muted">Month</TableHead>
            {METRIC_KEYS.map((k) => (
              <TableHead key={k} className="whitespace-nowrap text-right">
                {METRIC_LABELS[k]}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {aggregates.map((row) => (
            <TableRow key={`${row.year}-${row.month}`}>
              <TableCell className="sticky left-0 z-10 whitespace-nowrap bg-background font-medium">
                {MONTH_SHORT[row.month - 1]} {row.year}
              </TableCell>
              {METRIC_KEYS.map((k) => (
                <TableCell key={k} className="text-right tabular-nums">
                  {fmt(k, row[k])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function MasterCharts({ aggregates }: { aggregates: MonthlyAggregateRow[] }) {
  // Chart-friendly derived shape. `showUpRate` is the demos-conducted /
  // appointments-set ratio (0 when no appointments to avoid a
  // divide-by-zero); `salesTarget` may be null when no target row
  // exists for that (year, month).
  const chartData = aggregates.map((row) => ({
    month: `${MONTH_SHORT[row.month - 1]} ${String(row.year).slice(2)}`,
    phoneCalls: row.phoneCalls,
    dms: row.dms,
    cellConnects: row.cellConnects,
    appointmentsSet: row.appointmentsSet,
    demosConducted: row.demosConducted,
    introUnits: row.introUnits,
    basisUnits: row.basisUnits,
    majorUnits: row.majorUnits,
    sales: row.sales,
    collections: row.collections,
    salesTarget: row.salesTarget,
    showUpRate:
      row.appointmentsSet > 0
        ? Math.round((row.demosConducted / row.appointmentsSet) * 100)
        : 0,
  }))

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Master Phone Calls</CardTitle>
          <CardDescription>Monthly totals — last 12 months.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="phoneCalls" name="Phone Calls" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Master DMs</CardTitle>
          <CardDescription>Monthly totals — last 12 months.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="dms" name="DMs" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sales vs Collections</CardTitle>
          <CardDescription>Revenue booked vs cash actually received.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v) => CURRENCY.format(Number(v))} />
              <Legend />
              <Bar dataKey="sales" name="Sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="collections" name="Collections" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity Funnel</CardTitle>
          <CardDescription>
            Calls → Connects → Appointments → Demos. Watch for the drop-off.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="phoneCalls" name="Phone Calls" fill="hsl(var(--primary))" />
              <Bar dataKey="cellConnects" name="Cell Connects" fill="hsl(var(--chart-2))" />
              <Bar dataKey="appointmentsSet" name="Appts Set" fill="hsl(var(--chart-3))" />
              <Bar dataKey="demosConducted" name="Demos" fill="hsl(var(--chart-4))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Units Mix</CardTitle>
          <CardDescription>Intro / Basis / Major units sold per month.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="introUnits" name="Intro" stackId="units" fill="hsl(var(--chart-2))" />
              <Bar dataKey="basisUnits" name="Basis" stackId="units" fill="hsl(var(--chart-3))" />
              <Bar dataKey="majorUnits" name="Major" stackId="units" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Show-up Rate</CardTitle>
          <CardDescription>
            Demos conducted as a % of appointments set.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip formatter={(v) => `${v}%`} />
              <Line
                type="monotone"
                dataKey="showUpRate"
                name="Show-up %"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Target vs Actual Sales</CardTitle>
          <CardDescription>
            Monthly sales against the target set for that month.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v) => CURRENCY.format(Number(v))} />
              <Legend />
              <Bar
                dataKey="sales"
                name="Actual"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
              <Line
                type="monotone"
                dataKey="salesTarget"
                name="Target"
                stroke="hsl(var(--chart-4))"
                strokeWidth={2}
                dot={{ r: 4 }}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}

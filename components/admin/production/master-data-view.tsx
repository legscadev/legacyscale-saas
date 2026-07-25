'use client'

import { useState } from 'react'
import { BarChart3, Table as TableIcon } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
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
  const chartData = aggregates.map((row) => ({
    month: `${MONTH_SHORT[row.month - 1]} ${String(row.year).slice(2)}`,
    phoneCalls: row.phoneCalls,
    dms: row.dms,
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
              <Bar dataKey="phoneCalls" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
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
              <Bar dataKey="dms" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { CompletionsByWeekItem } from '@/lib/services/admin-progress-service'

const CONFIG = {
  count: {
    label: 'Completions',
    color: 'var(--color-success)',
  },
} satisfies ChartConfig

export function CompletionsChart({
  data,
}: {
  data: CompletionsByWeekItem[]
}) {
  const total = data.reduce((s, d) => s + d.count, 0)
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{total}</span>{' '}
        course {total === 1 ? 'completion' : 'completions'} over the last{' '}
        {data.length} weeks
      </p>
      <ChartContainer
        config={CONFIG}
        className="aspect-auto h-[200px] w-full"
      >
        <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            tickFormatter={(value: string) => value}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={4}
            allowDecimals={false}
            width={28}
          />
          <ChartTooltip
            cursor={{ fill: 'var(--color-muted)', opacity: 0.4 }}
            content={
              <ChartTooltipContent
                labelFormatter={(label) => `Week of ${label}`}
              />
            }
          />
          <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </div>
  )
}

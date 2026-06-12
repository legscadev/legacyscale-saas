'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { TopCourseItem } from '@/lib/services/admin-progress-service'

const CONFIG = {
  enrolledCount: {
    label: 'Enrolled',
    color: 'var(--color-brand-500)',
  },
} satisfies ChartConfig

// Tighten the long course titles so they read cleanly on the Y axis.
function shorten(title: string, max = 28): string {
  return title.length > max ? `${title.slice(0, max - 1)}…` : title
}

export function TopCoursesChart({ courses }: { courses: TopCourseItem[] }) {
  const data = courses.map((c) => ({
    title: c.title,
    short: shorten(c.title),
    enrolledCount: c.enrolledCount,
    completedCount: c.completedCount,
  }))

  return (
    <ChartContainer config={CONFIG} className="aspect-auto h-[200px] w-full">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: -8, bottom: 0 }}
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          tickMargin={4}
        />
        <YAxis
          dataKey="short"
          type="category"
          tickLine={false}
          axisLine={false}
          tickMargin={6}
          width={130}
        />
        <ChartTooltip
          cursor={{ fill: 'var(--color-muted)', opacity: 0.4 }}
          content={
            <ChartTooltipContent
              labelFormatter={(_label, payload) => {
                const row = payload[0]?.payload as
                  | { title?: string }
                  | undefined
                return row?.title ?? null
              }}
              formatter={(value) => `${value} enrolled`}
            />
          }
        />
        <Bar
          dataKey="enrolledCount"
          fill="var(--color-enrolledCount)"
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ChartContainer>
  )
}

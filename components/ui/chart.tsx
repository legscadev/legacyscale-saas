'use client'

import * as React from 'react'
import * as RechartsPrimitive from 'recharts'

import { cn } from '@/lib/utils'

/**
 * Tiny adaptation of the shadcn/ui chart wrapper, scaled down to what
 * we actually need on the admin dashboard:
 *
 *   - ChartContainer: ResponsiveContainer + CSS-variable colour theme.
 *   - ChartConfig: per-data-key labels + colours, injected as CSS
 *     variables on the container so recharts components can read them
 *     via `fill="var(--color-<key>)"`.
 *   - ChartTooltip: re-export of recharts' Tooltip.
 *   - ChartTooltipContent: themed default content for the tooltip
 *     (icon swatch + label + value).
 *
 * Skips Legend/LegendContent — neither dashboard chart uses one.
 * Extracted from shadcn's standard chart.tsx; trimmed for this app.
 */

const THEMES = { light: '', dark: '.dark' } as const

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
}

type ChartContextProps = { config: ChartConfig }

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const ctx = React.useContext(ChartContext)
  if (!ctx) throw new Error('useChart must be used inside a <ChartContainer />')
  return ctx
}

interface ChartContainerProps extends React.ComponentProps<'div'> {
  config: ChartConfig
  children: React.ComponentProps<
    typeof RechartsPrimitive.ResponsiveContainer
  >['children']
}

export function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: ChartContainerProps) {
  const uid = React.useId()
  const chartId = `chart-${id ?? uid.replace(/:/g, '')}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorEntries = Object.entries(config).filter(
    ([, cfg]) => cfg.theme || cfg.color,
  )
  if (colorEntries.length === 0) return null

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorEntries
  .map(([key, cfg]) => {
    const color =
      cfg.theme?.[theme as keyof typeof cfg.theme] ?? cfg.color
    return color ? `  --color-${key}: ${color};` : null
  })
  .filter(Boolean)
  .join('\n')}
}
`,
          )
          .join('\n'),
      }}
    />
  )
}

export const ChartTooltip = RechartsPrimitive.Tooltip

interface ChartTooltipContentProps {
  active?: boolean
  payload?: Array<{
    name?: string | number
    value?: number | string
    dataKey?: string | number
    payload?: Record<string, unknown>
    color?: string
  }>
  label?: string | number
  className?: string
  /** Override the displayed label. Receives the raw label + the
   *  matching payload row. */
  labelFormatter?: (
    label: unknown,
    payload: NonNullable<ChartTooltipContentProps['payload']>,
  ) => React.ReactNode
  /** Override per-value display. */
  formatter?: (
    value: number | string,
    name: string | number | undefined,
  ) => React.ReactNode
  hideLabel?: boolean
  hideIndicator?: boolean
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  className,
  labelFormatter,
  formatter,
  hideLabel = false,
  hideIndicator = false,
}: ChartTooltipContentProps) {
  const { config } = useChart()

  if (!active || !payload?.length) return null

  const labelNode = !hideLabel
    ? labelFormatter
      ? labelFormatter(label, payload)
      : (label ?? null)
    : null

  return (
    <div
      className={cn(
        'min-w-[8rem] rounded-lg border bg-background/95 p-2 text-xs shadow-md backdrop-blur',
        className,
      )}
    >
      {labelNode ? (
        <div className="mb-1.5 font-medium text-foreground">{labelNode}</div>
      ) : null}
      <div className="grid gap-1">
        {payload.map((entry, i) => {
          const key = String(entry.dataKey ?? entry.name ?? `row-${i}`)
          const itemConfig = config[key]
          const indicatorColor = entry.color ?? `var(--color-${key})`
          return (
            <div
              key={i}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-1.5">
                {!hideIndicator ? (
                  <span
                    className="size-2 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: indicatorColor }}
                  />
                ) : null}
                <span className="text-muted-foreground">
                  {itemConfig?.label ?? entry.name}
                </span>
              </div>
              <span className="font-mono font-medium tabular-nums text-foreground">
                {formatter
                  ? formatter(entry.value as number | string, entry.name)
                  : (entry.value as React.ReactNode)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

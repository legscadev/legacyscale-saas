import { cn } from "@/lib/utils"
import type { TrendPoint } from "@/lib/prototype"

interface DonutChartProps {
  data: TrendPoint[]
  size?: number
  className?: string
}

const SEGMENT_COLORS = [
  "hsl(var(--primary))",
  "var(--color-brand-300)",
  "var(--color-success)",
  "var(--color-warning)",
]

/** Donut with a centered total and a labeled legend. */
export function DonutChart({ data, size = 160, className }: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1
  const strokeWidth = size * 0.14
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const arcs = data.map((d, i) => ({
    label: d.label,
    dash: (d.value / total) * circumference,
    offset: data
      .slice(0, i)
      .reduce((sum, p) => sum + (p.value / total) * circumference, 0),
    color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
  }))

  return (
    <div className={cn("flex flex-wrap items-center gap-6", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {arcs.map((arc) => (
            <circle
              key={arc.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
              strokeDashoffset={-arc.offset}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold tabular-nums">
            {total.toLocaleString()}
          </span>
          <span className="text-[11px] text-muted-foreground">Total</span>
        </div>
      </div>
      <ul className="flex flex-1 flex-col gap-2 text-sm">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-sm"
              style={{ background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
            />
            <span className="flex-1 text-muted-foreground">{d.label}</span>
            <span className="tabular-nums font-medium">
              {Math.round((d.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

import { cn } from "@/lib/utils"
import type { TrendPoint } from "@/lib/prototype"

interface AreaChartProps {
  data: TrendPoint[]
  height?: number
  className?: string
}

const GRID = [0, 25, 50, 75, 100]

/** Lightweight area chart with gradient fill and x-axis labels. */
export function AreaChart({ data, height = 220, className }: AreaChartProps) {
  const max = Math.max(...data.map((d) => d.value)) * 1.1 || 1
  const coords = data.map((d, i) => ({
    x: (i / (data.length - 1)) * 100,
    y: 100 - (d.value / max) * 100,
    point: d,
  }))
  const line = coords.map((c) => `${c.x},${c.y}`).join(" ")
  const area = `0,100 ${line} 100,100`
  const id = "area-grad"

  return (
    <div className={cn("w-full", className)}>
      <div className="relative" style={{ height }}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="h-full w-full overflow-visible"
        >
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.28" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>
          {GRID.map((g) => (
            <line
              key={g}
              x1="0"
              x2="100"
              y1={g}
              y2={g}
              stroke="hsl(var(--border))"
              strokeWidth={0.5}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <polygon points={area} fill={`url(#${id})`} />
          <polyline
            points={line}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {coords.map((c) => (
            <circle
              key={c.point.label}
              cx={c.x}
              cy={c.y}
              r={1.6}
              fill="hsl(var(--background))"
              stroke="hsl(var(--primary))"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
        {data.map((d) => (
          <span key={d.label}>{d.label}</span>
        ))}
      </div>
    </div>
  )
}

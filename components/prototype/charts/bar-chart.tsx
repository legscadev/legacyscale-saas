import { cn } from "@/lib/utils"
import type { TrendPoint } from "@/lib/prototype"

interface BarChartProps {
  data: TrendPoint[]
  className?: string
  /** Render values as a compact count next to each bar. */
  showValues?: boolean
}

/** Horizontal labeled bars — ideal for category breakdowns and rankings. */
export function BarChart({ data, className, showValues = true }: BarChartProps) {
  const max = Math.max(...data.map((d) => d.value)) || 1

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {data.map((d) => (
        <div key={d.label} className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="truncate text-foreground">{d.label}</span>
            {showValues ? (
              <span className="tabular-nums text-muted-foreground">
                {d.value.toLocaleString()}
              </span>
            ) : null}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

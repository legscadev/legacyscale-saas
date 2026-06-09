import { ArrowDownRight, ArrowUpRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Sparkline } from "@/components/prototype/charts/sparkline"
import { CountUp } from "@/components/prototype/shared/count-up"
import type { KpiStat } from "@/lib/prototype"

export function StatCard({ stat, index = 0 }: { stat: KpiStat; index?: number }) {
  const positive = stat.delta >= 0
  const Arrow = positive ? ArrowUpRight : ArrowDownRight

  return (
    <Card
      className="gap-3 p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500"
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: "backwards" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{stat.label}</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums">
            <CountUp value={stat.value} />
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium",
            positive ? "bg-success/10 text-success" : "bg-error/10 text-error"
          )}
        >
          <Arrow className="size-3" />
          {Math.abs(stat.delta)}%
        </span>
      </div>
      <div className={cn(positive ? "text-success" : "text-error")}>
        <Sparkline data={stat.series} height={32} />
      </div>
      <p className="text-xs text-muted-foreground">{stat.deltaLabel}</p>
    </Card>
  )
}

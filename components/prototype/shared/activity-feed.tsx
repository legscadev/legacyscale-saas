import {
  CheckCircle2,
  CircleX,
  Megaphone,
  PlayCircle,
  Ticket,
  UserPlus,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { relativeTime, type ActivityItem } from "@/lib/prototype"

const ICONS: Record<ActivityItem["type"], { icon: LucideIcon; tone: string }> = {
  enrollment: { icon: Ticket, tone: "text-primary bg-primary/10" },
  completion: { icon: CheckCircle2, tone: "text-success bg-success/10" },
  quiz_passed: { icon: CheckCircle2, tone: "text-success bg-success/10" },
  quiz_failed: { icon: CircleX, tone: "text-error bg-error/10" },
  announcement: { icon: Megaphone, tone: "text-warning bg-warning/10" },
  member_joined: { icon: UserPlus, tone: "text-primary bg-primary/10" },
  lesson_started: { icon: PlayCircle, tone: "text-primary bg-primary/10" },
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <ul className="flex flex-col">
      {items.map((item, i) => {
        const { icon: Icon, tone } = ICONS[item.type]
        return (
          <li key={item.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full",
                  tone
                )}
              >
                <Icon className="size-3.5" />
              </span>
              {i < items.length - 1 ? (
                <span className="w-px flex-1 bg-border" />
              ) : null}
            </div>
            <div className="pb-5">
              <p className="text-sm leading-snug">
                <span className="font-medium">{item.actor}</span>{" "}
                <span className="text-muted-foreground">{item.target}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {relativeTime(item.timestamp)}
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

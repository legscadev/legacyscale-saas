import { FileText, ListChecks, PlayCircle, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import type { LessonType } from "@/lib/prototype"

const CONFIG: Record<LessonType, { label: string; icon: LucideIcon }> = {
  VIDEO: { label: "Video", icon: PlayCircle },
  QUIZ: { label: "Quiz", icon: ListChecks },
  RESOURCE: { label: "Resource", icon: FileText },
}

export function lessonIcon(type: LessonType): LucideIcon {
  return CONFIG[type].icon
}

interface LessonTypeBadgeProps {
  type: LessonType
  iconOnly?: boolean
  className?: string
}

export function LessonTypeBadge({
  type,
  iconOnly,
  className,
}: LessonTypeBadgeProps) {
  const { label, icon: Icon } = CONFIG[type]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground",
        className
      )}
    >
      <Icon className="size-3.5" />
      {iconOnly ? null : label}
    </span>
  )
}

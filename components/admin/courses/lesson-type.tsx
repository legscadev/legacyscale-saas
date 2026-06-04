import { FileText, ListChecks, PlayCircle, type LucideIcon } from 'lucide-react'

import type { LessonType } from '@prisma/client'

const LESSON_TYPE_META: Record<LessonType, { label: string; icon: LucideIcon }> = {
  VIDEO: { label: 'Video', icon: PlayCircle },
  QUIZ: { label: 'Quiz', icon: ListChecks },
  RESOURCE: { label: 'Resource', icon: FileText },
}

export function lessonTypeLabel(type: LessonType): string {
  return LESSON_TYPE_META[type].label
}

interface LessonTypeIconProps {
  type: LessonType
  className?: string
}

/**
 * Stable component wrapper so consumers can render the icon without
 * assigning the lucide ref to a local capital-letter variable — that
 * pattern trips React Compiler's "component created during render"
 * rule even though the underlying value is constant.
 */
export function LessonTypeIcon({ type, className }: LessonTypeIconProps) {
  const Icon = LESSON_TYPE_META[type].icon
  return <Icon className={className} />
}

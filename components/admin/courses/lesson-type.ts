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

export function lessonTypeIcon(type: LessonType): LucideIcon {
  return LESSON_TYPE_META[type].icon
}

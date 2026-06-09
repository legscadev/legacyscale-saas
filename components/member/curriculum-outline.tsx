import {
  CheckCircle2,
  FileText,
  GraduationCap,
  Loader2,
  PlayCircle,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import type { MemberCourseDetail } from '@/lib/services/member-course-service'

interface CurriculumOutlineProps {
  chapters: MemberCourseDetail['chapters']
}

function lessonIcon(
  type: 'VIDEO' | 'QUIZ' | 'RESOURCE',
  status: 'DRAFT' | 'PROCESSING' | 'READY',
): { Icon: LucideIcon; label: string } {
  if (status === 'PROCESSING') return { Icon: Loader2, label: 'Processing' }
  if (type === 'VIDEO') return { Icon: PlayCircle, label: 'Video' }
  if (type === 'QUIZ') return { Icon: GraduationCap, label: 'Quiz' }
  return { Icon: FileText, label: 'Resource' }
}

function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function CurriculumOutline({ chapters }: CurriculumOutlineProps) {
  return (
    <ol className="space-y-3">
      {chapters.map((chapter, i) => (
        <li key={chapter.id} className="rounded-xl border bg-card">
          <div className="border-b px-4 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Chapter {String(i + 1).padStart(2, '0')}
            </p>
            <p className="text-sm font-semibold">{chapter.title}</p>
          </div>
          {chapter.lessons.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              No lessons yet.
            </p>
          ) : (
            <ul className="divide-y">
              {chapter.lessons.map((lesson) => {
                const { Icon, label } = lessonIcon(lesson.type, lesson.status)
                const completed = lesson.progress?.completed ?? false
                const duration = formatDuration(lesson.durationSeconds)
                return (
                  <li
                    key={lesson.id}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    <Icon
                      className={cn(
                        'size-4 shrink-0 text-muted-foreground',
                        lesson.status === 'PROCESSING' && 'animate-spin',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{lesson.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {label}
                        {duration ? ` · ${duration}` : ''}
                      </p>
                    </div>
                    {completed ? (
                      <CheckCircle2 className="size-4 text-success" />
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </li>
      ))}
    </ol>
  )
}

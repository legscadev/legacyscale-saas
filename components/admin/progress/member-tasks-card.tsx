// Compact "Tasks & Goals" card on the per-student progress page.
// Shows the student's open tasks (overdue first), with a "View all"
// deep-link into the global /admin/progress/tasks?studentId=X list.
//
// Read-only — same posture as the global list. Follow-up is via the
// existing per-member nudge action already on the page.

import Link from 'next/link'
import { AlertCircle, ClipboardList, ExternalLink } from 'lucide-react'

import { SectionCard } from '@/components/shared'
import { cn } from '@/lib/utils'
import type { AdminStudentTaskItem } from '@/lib/services/admin-student-task-service'

interface Props {
  studentId: string
  tasks: AdminStudentTaskItem[]
  counts: { open: number; overdue: number }
}

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

export function MemberTasksCard({ studentId, tasks, counts }: Props) {
  return (
    <SectionCard
      title="Tasks & Goals"
      description={
        counts.open === 0
          ? 'No open tasks. Anything they add to /tasks shows up here.'
          : `${counts.open} open${counts.overdue > 0 ? ` · ${counts.overdue} overdue` : ''}`
      }
      flush
    >
      {tasks.length === 0 ? (
        <div className="flex items-center gap-3 px-6 py-8 text-sm text-muted-foreground">
          <ClipboardList className="size-5 shrink-0" />
          This student hasn&apos;t created any personal tasks yet.
        </div>
      ) : (
        <ul className="divide-y">
          {tasks.map((t) => {
            const isOverdue = t.isOverdue
            return (
              <li
                key={t.id}
                className="flex items-start gap-3 px-5 py-3 text-sm"
              >
                <span
                  className={cn(
                    'mt-1 size-2 shrink-0 rounded-full',
                    isOverdue
                      ? 'bg-destructive'
                      : 'bg-muted-foreground/30',
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium leading-snug">
                    {t.title}
                  </p>
                  {t.linkedLesson ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {t.linkedCourse?.title
                        ? `${t.linkedCourse.title} · `
                        : ''}
                      {t.linkedLesson.title}
                    </p>
                  ) : t.linkedCourse ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {t.linkedCourse.title}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right text-xs tabular-nums">
                  {t.dueDate ? (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1',
                        isOverdue
                          ? 'font-medium text-destructive'
                          : 'text-muted-foreground',
                      )}
                    >
                      {isOverdue ? (
                        <AlertCircle className="size-3" />
                      ) : null}
                      {DATE_FMT.format(t.dueDate)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/60">
                      No due date
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Footer: link to the full filtered list. Renders even when
          empty so admins can still land on the global page pre-scoped
          to this student. */}
      <div className="flex justify-end border-t px-5 py-3">
        <Link
          href={`/admin/progress/tasks?studentId=${studentId}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          View all in tracker
          <ExternalLink className="size-3" />
        </Link>
      </div>
    </SectionCard>
  )
}

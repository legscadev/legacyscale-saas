// Shared prefill template for task-specific nudges. Kept in a
// standalone module so both the global /admin/progress/tasks table
// and the per-student MemberTasksCard can use the same wording.

import type { AdminStudentTaskItem } from '@/lib/services/admin-student-task-service'

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

/** Compose a friendly, context-aware nudge message for a student
 *  task. Handles overdue vs upcoming vs no-due-date. */
export function nudgeTemplateForTask(task: AdminStudentTaskItem): string {
  const firstName =
    task.student.name?.trim().split(/\s+/)[0] ??
    task.student.email.split('@')[0] ??
    'there'
  const title = task.title
  if (task.dueDate) {
    const when = DATE_FMT.format(task.dueDate)
    if (task.isOverdue) {
      return `Hey ${firstName} — just checking in on "${title}". It was due ${when}. Anything blocking you? Happy to help.`
    }
    return `Hey ${firstName} — a quick nudge on "${title}" (due ${when}). Let me know if you want to talk through it.`
  }
  return `Hey ${firstName} — checking in on "${title}". Let me know how it's going.`
}

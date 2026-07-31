import { PageHeader } from '@/components/shared'
import { StudentTasksShell } from '@/components/student/student-tasks-shell'
import { requireActiveUser } from '@/lib/auth'
import { studentTaskService } from '@/lib/services/student-task-service'

// Full CRUD surface for the student's personal task/goal list.
// SSR loads the initial payload so the first paint is complete;
// mutations go through the actions in ./actions.ts and reconcile
// via router.refresh() from the client shell.

export const dynamic = 'force-dynamic'

export default async function StudentTasksPage() {
  const user = await requireActiveUser()
  const tasks = await studentTaskService.list(user.id)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks & Goals"
        description="Your personal to-do list. Set a due date so upcoming items surface on the dashboard."
      />
      <StudentTasksShell initialTasks={tasks} />
    </div>
  )
}

'use client'

// Compact "My tasks" card for the student dashboard. Shows the
// next few upcoming/overdue items with an inline quick-add row
// (title + due date only). Full CRUD lives on /tasks.

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  createStudentTaskAction,
  toggleStudentTaskAction,
} from '@/app/(user)/tasks/actions'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { fmtCalendarDateShort } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { StudentTaskItem } from '@/lib/services/student-task-service'

interface Props {
  initialTasks: StudentTaskItem[]
}

function startOfToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function isOverdue(task: StudentTaskItem, todayStart: Date): boolean {
  if (task.completedAt || !task.dueDate) return false
  const due = new Date(task.dueDate)
  const dueLocal = new Date(
    due.getUTCFullYear(),
    due.getUTCMonth(),
    due.getUTCDate(),
  )
  return dueLocal < todayStart
}

function isToday(task: StudentTaskItem, todayStart: Date): boolean {
  if (task.completedAt || !task.dueDate) return false
  const due = new Date(task.dueDate)
  const dueLocal = new Date(
    due.getUTCFullYear(),
    due.getUTCMonth(),
    due.getUTCDate(),
  )
  return dueLocal.getTime() === todayStart.getTime()
}

export function DashboardTasksCard({ initialTasks }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [tasks, setTasks] = useState<StudentTaskItem[]>(initialTasks)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')

  const todayStart = useMemo(() => startOfToday(), [])
  const overdueCount = tasks.filter((t) => isOverdue(t, todayStart)).length
  const todayCount = tasks.filter((t) => isToday(t, todayStart)).length

  function refresh() {
    router.refresh()
  }

  function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    startTransition(async () => {
      const res = await createStudentTaskAction({
        title: title.trim(),
        dueDate: dueDate || undefined,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not add task')
        return
      }
      setTasks((prev) => [res.data, ...prev.slice(0, 4)])
      setTitle('')
      setDueDate('')
      refresh()
    })
  }

  function handleToggle(task: StudentTaskItem, completed: boolean) {
    const before = task.completedAt
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, completedAt: completed ? new Date() : null }
          : t,
      ),
    )
    startTransition(async () => {
      const res = await toggleStudentTaskAction({
        taskId: task.id,
        completed,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not update task')
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, completedAt: before } : t,
          ),
        )
        return
      }
      // Drop completed items from the widget after a beat so the
      // list stays short — full history lives on /tasks.
      setTimeout(() => {
        setTasks((prev) => prev.filter((t) => !t.completedAt || t.id !== task.id))
        refresh()
      }, 400)
    })
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="size-4" />
          My tasks
          {overdueCount > 0 ? (
            <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
              {overdueCount} overdue
            </span>
          ) : todayCount > 0 ? (
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {todayCount} today
            </span>
          ) : null}
        </CardTitle>
        <Link
          href="/tasks"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Open list
          <ArrowRight className="size-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          onSubmit={handleQuickAdd}
          className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 p-2"
        >
          <Plus className="ml-1 size-4 text-muted-foreground" aria-hidden />
          <Input
            placeholder="Add a task…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-8 min-w-0 flex-1 border-none bg-transparent shadow-none focus-visible:ring-0"
            disabled={pending}
            maxLength={200}
          />
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="h-8 w-36"
            disabled={pending}
            title="Due date (optional)"
          />
          <Button type="submit" size="sm" disabled={pending || !title.trim()}>
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : 'Add'}
          </Button>
        </form>

        {tasks.length === 0 ? (
          <p className="rounded-md border border-dashed bg-muted/10 px-3 py-6 text-center text-xs text-muted-foreground">
            No open tasks. Add one above to see it here and on the tasks page.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {tasks.map((task) => {
              const overdue = isOverdue(task, todayStart)
              const today = isToday(task, todayStart)
              return (
                <li
                  key={task.id}
                  className="flex items-start gap-2 px-3 py-2.5"
                >
                  <Checkbox
                    checked={!!task.completedAt}
                    onCheckedChange={(v) => handleToggle(task, !!v)}
                    disabled={pending}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'truncate text-sm',
                        task.completedAt &&
                          'text-muted-foreground line-through',
                      )}
                    >
                      {task.title}
                    </p>
                    {task.dueDate ? (
                      <span
                        className={cn(
                          'mt-0.5 inline-flex items-center gap-1 text-[11px] tabular-nums',
                          overdue
                            ? 'text-destructive'
                            : today
                              ? 'text-primary'
                              : 'text-muted-foreground',
                        )}
                      >
                        <CalendarDays className="size-3" aria-hidden />
                        {fmtCalendarDateShort(task.dueDate)}
                      </span>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

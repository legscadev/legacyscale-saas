'use client'

// Full page for the student's personal task/goal list. Groups
// tasks into Overdue / Today / Upcoming / Someday / Completed
// buckets so the eye lands on what's actually urgent. Inline add
// form at the top; each row supports toggle-complete + delete +
// inline edit.
//
// The dashboard reuses the same task rows via a compact
// StudentTaskRow — this file owns the layout scaffolding.

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  createStudentTaskAction,
  deleteStudentTaskAction,
  toggleStudentTaskAction,
  updateStudentTaskAction,
} from '@/app/(user)/tasks/actions'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { fmtCalendarDateShort, toCalendarDateInput } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { StudentTaskItem } from '@/lib/services/student-task-service'

interface Props {
  initialTasks: StudentTaskItem[]
}

type Bucket = 'overdue' | 'today' | 'upcoming' | 'someday' | 'completed'

const BUCKET_LABELS: Record<Bucket, string> = {
  overdue: 'Overdue',
  today: 'Today',
  upcoming: 'Upcoming',
  someday: 'Someday',
  completed: 'Completed',
}

/** Local-timezone start of "today" — matters because the dueDate
 *  column is a @db.Date so it comes back as UTC-midnight; we do
 *  our comparison in the visitor's local zone. */
function startOfToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function bucketOf(task: StudentTaskItem, todayStart: Date): Bucket {
  if (task.completedAt) return 'completed'
  if (!task.dueDate) return 'someday'
  const due = new Date(task.dueDate)
  const dueLocal = new Date(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate())
  if (dueLocal < todayStart) return 'overdue'
  if (dueLocal.getTime() === todayStart.getTime()) return 'today'
  return 'upcoming'
}

const BUCKET_ORDER: Bucket[] = [
  'overdue',
  'today',
  'upcoming',
  'someday',
  'completed',
]

export function StudentTasksShell({ initialTasks }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [tasks, setTasks] = useState<StudentTaskItem[]>(initialTasks)
  const [addOpen, setAddOpen] = useState(false)

  const buckets = useMemo(() => {
    const today = startOfToday()
    const grouped: Record<Bucket, StudentTaskItem[]> = {
      overdue: [],
      today: [],
      upcoming: [],
      someday: [],
      completed: [],
    }
    for (const t of tasks) grouped[bucketOf(t, today)].push(t)
    return grouped
  }, [tasks])

  function refresh() {
    router.refresh()
  }

  function handleToggle(task: StudentTaskItem, completed: boolean) {
    // Optimistic — flip the local copy so the checkbox responds
    // instantly, roll back on failure.
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
      setTasks((prev) => prev.map((t) => (t.id === task.id ? res.data : t)))
      refresh()
    })
  }

  function handleDelete(taskId: string) {
    startTransition(async () => {
      const res = await deleteStudentTaskAction({ taskId })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not delete task')
        return
      }
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      refresh()
    })
  }

  function handleCreated(task: StudentTaskItem) {
    setTasks((prev) => [task, ...prev])
    setAddOpen(false)
    refresh()
  }

  function handleUpdated(task: StudentTaskItem) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)))
    refresh()
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card">
        {addOpen ? (
          <TaskEditForm
            mode="create"
            onCancel={() => setAddOpen(false)}
            onSaved={handleCreated}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex w-full items-center gap-2 p-4 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/40"
          >
            <Plus className="size-4" />
            Add a task or goal
          </button>
        )}
      </div>

      {BUCKET_ORDER.map((bucket) => {
        const items = buckets[bucket]
        if (items.length === 0) return null
        return (
          <section key={bucket} className="space-y-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {BUCKET_LABELS[bucket]}
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-foreground">
                {items.length}
              </span>
            </h2>
            <ul className="divide-y overflow-hidden rounded-lg border bg-card">
              {items.map((task) => (
                <StudentTaskRow
                  key={task.id}
                  task={task}
                  bucket={bucket}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onUpdated={handleUpdated}
                  disabled={pending}
                />
              ))}
            </ul>
          </section>
        )
      })}

      {tasks.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
          No tasks yet. Add one above to see it here + on your dashboard.
        </p>
      ) : null}
    </div>
  )
}

// ============================================
// ROW
// ============================================

export function StudentTaskRow({
  task,
  bucket,
  onToggle,
  onDelete,
  onUpdated,
  disabled,
}: {
  task: StudentTaskItem
  bucket: Bucket
  onToggle: (task: StudentTaskItem, completed: boolean) => void
  onDelete: (taskId: string) => void
  onUpdated: (task: StudentTaskItem) => void
  disabled: boolean
}) {
  const [editing, setEditing] = useState(false)
  const done = !!task.completedAt

  if (editing) {
    return (
      <li className="p-3">
        <TaskEditForm
          mode="update"
          initial={task}
          onCancel={() => setEditing(false)}
          onSaved={(next) => {
            onUpdated(next)
            setEditing(false)
          }}
        />
      </li>
    )
  }

  return (
    <li className="group flex items-start gap-3 p-3">
      <Checkbox
        checked={done}
        onCheckedChange={(v) => onToggle(task, !!v)}
        disabled={disabled}
        className="mt-1"
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-sm font-medium leading-snug',
            done && 'text-muted-foreground line-through',
          )}
        >
          {task.title}
        </p>
        {task.description ? (
          <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted-foreground">
            {task.description}
          </p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {task.dueDate ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 tabular-nums',
                bucket === 'overdue'
                  ? 'text-destructive'
                  : bucket === 'today'
                    ? 'text-primary'
                    : 'text-muted-foreground',
              )}
            >
              <CalendarDays className="size-3" aria-hidden />
              {fmtCalendarDateShort(task.dueDate)}
            </span>
          ) : null}
          {task.linkedCourse ? (
            <Link
              href={`/courses/${task.linkedCourse.slug}`}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <BookOpen className="size-3" aria-hidden />
              {task.linkedLesson?.title ?? task.linkedCourse.title}
              <ArrowRight className="size-3" aria-hidden />
            </Link>
          ) : null}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={disabled}
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Task actions"
              className="size-7 opacity-0 transition-opacity group-hover:opacity-100"
            />
          }
        >
          <MoreVertical className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => onDelete(task.id)}
          >
            <Trash2 className="size-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}

// ============================================
// EDIT / CREATE FORM (shared)
// ============================================

function TaskEditForm({
  mode,
  initial,
  onCancel,
  onSaved,
}: {
  mode: 'create' | 'update'
  initial?: StudentTaskItem
  onCancel: () => void
  onSaved: (task: StudentTaskItem) => void
}) {
  const [pending, startTransition] = useTransition()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [dueDate, setDueDate] = useState(
    initial?.dueDate ? toCalendarDateInput(new Date(initial.dueDate)) : '',
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }
    startTransition(async () => {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        dueDate: dueDate || undefined,
      }
      const res =
        mode === 'create'
          ? await createStudentTaskAction(payload)
          : await updateStudentTaskAction({ taskId: initial!.id, ...payload })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not save task')
        return
      }
      onSaved(res.data)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 p-3">
      <Input
        autoFocus
        placeholder="What do you want to get done?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
        disabled={pending}
      />
      <Textarea
        placeholder="Notes (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        disabled={pending}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" />
          Due
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="h-8 w-40"
            disabled={pending}
          />
        </label>
        <div className="flex gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={pending}
          >
            <X className="size-3.5" />
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            {mode === 'create' ? 'Add task' : 'Save'}
          </Button>
        </div>
      </div>
    </form>
  )
}

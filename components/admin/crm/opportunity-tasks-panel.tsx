'use client'

// Tasks tab inside the edit-opportunity dialog. Loads the timeline on
// mount and renders a compact list with add / toggle-complete /
// delete. Optimistic on toggle so ticking a checkbox feels
// instantaneous; other ops go through startTransition + refetch.
//
// Assignee defaults to the currently signed-in user server-side, so
// the add form only needs a title + optional due date. GHL surfaces
// assignee editing via row-hover; we keep parity by exposing it
// through the row menu (Assignee picker inline).

import { useEffect, useMemo, useState, useTransition } from 'react'
import {
  CalendarDays,
  Loader2,
  Plus,
  Search,
  Trash2,
  User as UserIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  createOpportunityTaskAction,
  deleteOpportunityTaskAction,
  fetchOpportunityTasksAction,
  toggleOpportunityTaskAction,
} from '@/app/(admin)/admin/crm/opportunities/actions'
import type { CrmTeamMember } from '@/app/(admin)/admin/crm/opportunities/actions'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { fmtCalendarDateShort } from '@/lib/format'
import type { OpportunityTaskItem } from '@/lib/services/crm-opportunity-task-service'
import { cn } from '@/lib/utils'

interface Props {
  opportunityId: string
  members: CrmTeamMember[]
  /** Fired after any mutation so the parent can refetch the board
   *  counters (open-task badge on the card). */
  onChanged?: () => void
}

export function OpportunityTasksPanel({
  opportunityId,
  members,
  onChanged,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<OpportunityTaskItem[]>([])
  const [pending, startTransition] = useTransition()
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')

  // New-task inline form state.
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [assigneeId, setAssigneeId] = useState('')

  async function load() {
    const res = await fetchOpportunityTasksAction(opportunityId)
    if (!res.ok) {
      toast.error(res.error ?? 'Could not load tasks')
      return
    }
    setTasks(res.data)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchOpportunityTasksAction(opportunityId).then((res) => {
      if (cancelled) return
      setLoading(false)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not load tasks')
        return
      }
      setTasks(res.data)
    })
    return () => {
      cancelled = true
    }
  }, [opportunityId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return tasks
    return tasks.filter((t) => t.title.toLowerCase().includes(q))
  }, [tasks, search])

  function resetAddForm() {
    setTitle('')
    setDueDate('')
    setAssigneeId('')
    setAdding(false)
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Task title is required')
      return
    }
    startTransition(async () => {
      const res = await createOpportunityTaskAction({
        opportunityId,
        title: title.trim(),
        dueDate: dueDate || undefined,
        assigneeId: assigneeId || null,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not create task')
        return
      }
      // Prepend so newest is visible immediately.
      setTasks((prev) => [res.data, ...prev])
      resetAddForm()
      onChanged?.()
    })
  }

  function handleToggle(task: OpportunityTaskItem, completed: boolean) {
    // Optimistic: flip completedAt locally so the checkbox reacts
    // instantly, then reconcile with the server response.
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, completedAt: completed ? new Date() : null }
          : t,
      ),
    )
    startTransition(async () => {
      const res = await toggleOpportunityTaskAction({
        taskId: task.id,
        completed,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not update task')
        // Rewind on failure.
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, completedAt: task.completedAt } : t,
          ),
        )
        return
      }
      setTasks((prev) => prev.map((t) => (t.id === task.id ? res.data : t)))
      onChanged?.()
    })
  }

  function handleDelete(taskId: string) {
    startTransition(async () => {
      const res = await deleteOpportunityTaskAction({ taskId })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not delete task')
        return
      }
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      onChanged?.()
    })
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Tasks</h3>
        {adding ? null : (
          <Button
            type="button"
            size="sm"
            onClick={() => setAdding(true)}
            disabled={pending}
          >
            <Plus className="mr-1.5 size-3.5" />
            Add task
          </Button>
        )}
      </div>

      {adding ? (
        <form
          onSubmit={handleAdd}
          className="space-y-2 rounded-md border bg-muted/20 p-3"
        >
          <Input
            autoFocus
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Assign to me</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name ?? m.email}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetAddForm}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? 'Adding…' : 'Add task'}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by title"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 pl-8 text-sm"
        />
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
          {tasks.length === 0
            ? 'No tasks yet. Add one to keep the deal moving.'
            : 'No tasks match your search.'}
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {filtered.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={(completed) => handleToggle(task, completed)}
              onDelete={() => handleDelete(task.id)}
              disabled={pending}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function TaskRow({
  task,
  onToggle,
  onDelete,
  disabled,
}: {
  task: OpportunityTaskItem
  onToggle: (completed: boolean) => void
  onDelete: () => void
  disabled: boolean
}) {
  const isDone = !!task.completedAt
  const isOverdue =
    !isDone && task.dueDate ? task.dueDate.getTime() < Date.now() : false

  return (
    <li className="group flex items-start gap-3 px-3 py-2.5">
      <Checkbox
        checked={isDone}
        onCheckedChange={(v) => onToggle(!!v)}
        disabled={disabled}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-sm leading-snug',
            isDone && 'text-muted-foreground line-through',
          )}
        >
          {task.title}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {task.dueDate ? (
            <span
              className={cn(
                'inline-flex items-center gap-1',
                isOverdue && !isDone && 'text-destructive',
              )}
            >
              <CalendarDays className="size-3" aria-hidden />
              Due {fmtCalendarDateShort(task.dueDate)}
            </span>
          ) : null}
          {task.assignee ? (
            <span className="inline-flex items-center gap-1">
              <UserIcon className="size-3" aria-hidden />
              {task.assignee.name ?? task.assignee.email.split('@')[0]}
            </span>
          ) : null}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onDelete}
        disabled={disabled}
        aria-label="Delete task"
        className="size-7 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </li>
  )
}

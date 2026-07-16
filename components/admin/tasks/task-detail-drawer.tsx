'use client'

// Task detail drawer. Opens whenever ?task=<id> is in the URL —
// deep-linkable, refresh-safe. Reads a bundled payload (task +
// comments + checklists + activity) via one server round trip so
// there's no waterfall.
//
// Phase 4.1 ships the read-only surface (header + description +
// meta grid + assignees/watchers/labels + subtasks + counts).
// Editable inline fields, comment composer, checklist CRUD, and
// the activity timeline land in 4.2 → 4.6.

import { format } from 'date-fns'
import { User } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  fetchTaskDrawerAction,
  type TaskDrawerPayload,
} from '@/app/(admin)/admin/tasks/actions'
import { AvatarGroup } from '@/components/shared/avatar-group'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import type { TaskUserRef } from '@/lib/services/task-service'

import { LabelChip, PriorityPill, StatusPill } from './task-pills'

interface TaskDetailDrawerProps {
  taskId: string | null
  onOpenChange: (open: boolean) => void
}

export function TaskDetailDrawer({
  taskId,
  onOpenChange,
}: TaskDetailDrawerProps) {
  const open = taskId !== null
  const [payload, setPayload] = useState<TaskDrawerPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!taskId) {
      setPayload(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchTaskDrawerAction(taskId).then((res) => {
      if (cancelled) return
      if (!res.ok) {
        setPayload(null)
        setError(res.error ?? 'Could not load task')
        setLoading(false)
        return
      }
      setPayload(res.data)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [taskId])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="text-base font-medium leading-snug">
            {payload?.task.title ?? (loading ? 'Loading…' : 'Task')}
          </SheetTitle>
        </SheetHeader>

        <SheetBody className="space-y-5">
          {loading ? (
            <DrawerSkeleton />
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : payload ? (
            <ReadOnlyBody payload={payload} />
          ) : null}
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}

// =========================================================
// Skeleton
// =========================================================

function DrawerSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
      <Skeleton className="h-40 w-full" />
    </div>
  )
}

// =========================================================
// Body
// =========================================================

interface ReadOnlyBodyProps {
  payload: TaskDrawerPayload
}

function ReadOnlyBody({ payload }: ReadOnlyBodyProps) {
  const { task, comments, checklists, activity } = payload
  const totalChecklistItems = checklists.reduce(
    (n, c) => n + c.items.length,
    0,
  )
  const doneChecklistItems = checklists.reduce(
    (n, c) => n + c.items.filter((i) => i.isDone).length,
    0,
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill name={task.status.name} color={task.status.color} />
        <PriorityPill priority={task.priority} />
        {task.category ? (
          <span
            className="rounded-md border px-1.5 py-0.5 text-[11px] font-medium"
            style={{
              backgroundColor: `${task.category.color}14`,
              borderColor: `${task.category.color}66`,
              color: task.category.color,
            }}
          >
            {task.category.name}
          </span>
        ) : null}
      </div>

      <DescriptionBlock description={task.description} />

      <MetaGrid task={task} />

      <PeopleBlock
        reporter={task.reporter}
        assignees={task.assignees}
        watchers={task.watchers}
      />

      <LabelsBlock labels={task.labels} />

      {task.subtasks.length > 0 ? (
        <SubtasksBlock subtasks={task.subtasks} />
      ) : null}

      <CountsBlock
        comments={comments.length}
        checklistTotal={totalChecklistItems}
        checklistDone={doneChecklistItems}
        activity={activity.length}
      />
    </div>
  )
}

// =========================================================
// Sub-blocks
// =========================================================

function DescriptionBlock({ description }: { description: string | null }) {
  if (!description) {
    return (
      <Section label="Description">
        <p className="text-sm text-muted-foreground italic">
          No description yet.
        </p>
      </Section>
    )
  }
  return (
    <Section label="Description">
      <p className="whitespace-pre-wrap text-sm text-foreground">
        {description}
      </p>
    </Section>
  )
}

function MetaGrid({
  task,
}: {
  task: TaskDrawerPayload['task']
}) {
  const cells: Array<{ label: string; value: React.ReactNode }> = [
    {
      label: 'Start date',
      value: task.startDate ? format(task.startDate, 'MMM d, yyyy') : '—',
    },
    {
      label: 'Due date',
      value: task.dueDate ? format(task.dueDate, 'MMM d, yyyy') : '—',
    },
    {
      label: 'Estimated hours',
      value: task.estimatedHours !== null ? `${task.estimatedHours}h` : '—',
    },
    {
      label: 'Actual hours',
      value: task.actualHours !== null ? `${task.actualHours}h` : '—',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/20 p-3">
      {cells.map((cell) => (
        <div key={cell.label} className="space-y-0.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {cell.label}
          </p>
          <p className="text-sm text-foreground tabular-nums">{cell.value}</p>
        </div>
      ))}
    </div>
  )
}

function PeopleBlock({
  reporter,
  assignees,
  watchers,
}: {
  reporter: TaskUserRef | null
  assignees: TaskUserRef[]
  watchers: TaskUserRef[]
}) {
  return (
    <Section label="People">
      <div className="space-y-3">
        <PersonRow label="Reporter" people={reporter ? [reporter] : []} />
        <PersonRow label="Assignees" people={assignees} />
        <PersonRow label="Watchers" people={watchers} />
      </div>
    </Section>
  )
}

function PersonRow({
  label,
  people,
}: {
  label: string
  people: TaskUserRef[]
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {people.length === 0 ? (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <User className="size-3" aria-hidden />
          Unassigned
        </span>
      ) : (
        <div className="flex items-center gap-2">
          <AvatarGroup
            users={people.map((p) => ({
              name: p.name ?? p.email,
              avatarUrl: null,
            }))}
            size="sm"
            max={5}
          />
          <span className="text-xs text-muted-foreground">
            {people
              .slice(0, 3)
              .map((p) => p.name ?? p.email.split('@')[0])
              .join(', ')}
            {people.length > 3 ? ` +${people.length - 3}` : ''}
          </span>
        </div>
      )}
    </div>
  )
}

function LabelsBlock({
  labels,
}: {
  labels: Array<{ id: string; name: string; color: string }>
}) {
  return (
    <Section label="Labels">
      {labels.length === 0 ? (
        <p className="text-xs text-muted-foreground">No labels attached.</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {labels.map((l) => (
            <LabelChip key={l.id} name={l.name} color={l.color} />
          ))}
        </div>
      )}
    </Section>
  )
}

function SubtasksBlock({
  subtasks,
}: {
  subtasks: TaskDrawerPayload['task']['subtasks']
}) {
  return (
    <Section label={`Subtasks (${subtasks.length})`}>
      <ul className="space-y-1">
        {subtasks.map((st) => (
          <li
            key={st.id}
            className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm"
          >
            <span className="min-w-0 truncate">{st.title}</span>
            <span className="text-xs text-muted-foreground">
              {st.statusName}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function CountsBlock({
  comments,
  checklistTotal,
  checklistDone,
  activity,
}: {
  comments: number
  checklistTotal: number
  checklistDone: number
  activity: number
}) {
  return (
    <Section label="Activity summary">
      <div className="grid grid-cols-3 gap-3 text-center">
        <CountCell label="Comments" value={comments} />
        <CountCell
          label="Checklist"
          value={
            checklistTotal > 0
              ? `${checklistDone}/${checklistTotal}`
              : '—'
          }
        />
        <CountCell label="Events" value={activity} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Comment composer, checklist CRUD, and the activity timeline
        land in Phase 4.4 → 4.6.
      </p>
    </Section>
  )
}

function CountCell({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <div className="rounded-md border bg-muted/20 p-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function Section({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {children}
    </section>
  )
}


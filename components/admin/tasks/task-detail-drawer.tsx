'use client'

// Task detail drawer. Opens whenever ?task=<id> is in the URL —
// deep-linkable, refresh-safe. Reads a bundled payload (task +
// comments + checklists + activity) via one server round trip.
//
// Local `task` state is kept in sync with the fetched payload;
// each inline-editable field commits via updateTaskAction and
// patches the local state on success so the drawer reflects the
// change without waiting for a full refetch. onChanged bubbles
// out to the shell so the stat strip and list/board re-hydrate.

import { User } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import {
  fetchTaskDrawerAction,
  type TaskDrawerPayload,
  type TeamMember,
  type WorkflowCategory,
  type WorkflowLabel,
  type WorkflowStatus,
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
import type { TaskDetail, TaskUserRef } from '@/lib/services/task-service'

import { TaskActivityPanel } from './task-activity-panel'
import { TaskAttachmentsPanel } from './task-attachments-panel'
import { TaskChecklistsPanel } from './task-checklists-panel'
import { TaskCommentsPanel } from './task-comments-panel'
import {
  EditableCategory,
  EditableDate,
  EditableDescription,
  EditableHours,
  EditablePriority,
  EditableStatus,
  EditableTitle,
} from './task-detail-fields'
import {
  AssigneePicker,
  LabelPicker,
  WatcherPicker,
} from './task-multiselect'

interface TaskDetailDrawerProps {
  taskId: string | null
  statuses: WorkflowStatus[]
  categories: WorkflowCategory[]
  labels: WorkflowLabel[]
  members: TeamMember[]
  currentUserId: string
  onOpenChange: (open: boolean) => void
  /** Fires after any drawer mutation succeeds so the shell can
   *  revalidate the stat strip + list/board counts. */
  onChanged?: () => void
}

export function TaskDetailDrawer({
  taskId,
  statuses,
  categories,
  labels,
  members,
  currentUserId,
  onOpenChange,
  onChanged,
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

  /** Silent re-fetch of the drawer payload — called by the
   *  comment / checklist panels after a mutation so their section
   *  counts + the activity timeline pick up the change without a
   *  visible loading flash. */
  const refetch = useCallback(async () => {
    if (!taskId) return
    const res = await fetchTaskDrawerAction(taskId)
    if (res.ok) setPayload(res.data)
    onChanged?.()
  }, [taskId, onChanged])

  /** Merge a patch into the local task state so field edits reflect
   *  immediately, and bubble a workspace refresh out to the shell. */
  function applyPatch(patch: Partial<TaskDetail>) {
    setPayload((prev) =>
      prev ? { ...prev, task: { ...prev.task, ...patch } } : prev,
    )
    onChanged?.()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          {payload ? (
            <>
              <SheetTitle className="sr-only">
                {payload.task.title}
              </SheetTitle>
              <EditableTitle task={payload.task} onSaved={applyPatch} />
            </>
          ) : (
            <SheetTitle className="text-base font-medium leading-snug">
              {loading ? 'Loading…' : 'Task'}
            </SheetTitle>
          )}
        </SheetHeader>

        <SheetBody className="space-y-5">
          {loading ? (
            <DrawerSkeleton />
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : payload ? (
            <EditableBody
              payload={payload}
              statuses={statuses}
              categories={categories}
              labels={labels}
              members={members}
              currentUserId={currentUserId}
              onPatch={applyPatch}
              onRefetch={refetch}
            />
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

interface EditableBodyProps {
  payload: TaskDrawerPayload
  statuses: WorkflowStatus[]
  categories: WorkflowCategory[]
  labels: WorkflowLabel[]
  members: TeamMember[]
  currentUserId: string
  onPatch: (patch: Partial<TaskDetail>) => void
  /** Refetch the drawer payload — used by comment/checklist
   *  panels after a mutation so section counts + the activity
   *  timeline pick up the change. */
  onRefetch: () => void | Promise<void>
}

function EditableBody({
  payload,
  statuses,
  categories,
  labels,
  members,
  currentUserId,
  onPatch,
  onRefetch,
}: EditableBodyProps) {
  const { task, comments, checklists, activity, attachments } = payload
  const totalChecklistItems = checklists.reduce(
    (n, c) => n + c.items.length,
    0,
  )
  const doneChecklistItems = checklists.reduce(
    (n, c) => n + c.items.filter((i) => i.isDone).length,
    0,
  )

  // Id → name maps handed to the activity panel so it can render
  // human-readable diffs without another fetch.
  const statusNameById = new Map(statuses.map((s) => [s.id, s.name]))
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]))
  const labelNameById = new Map(labels.map((l) => [l.id, l.name]))
  const memberNameById = new Map(
    members.map((m) => [m.id, m.name ?? m.email.split('@')[0] ?? m.email]),
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <EditableStatus
          task={task}
          statuses={statuses}
          onSaved={onPatch}
        />
        <EditablePriority task={task} onSaved={onPatch} />
        <EditableCategory
          task={task}
          categories={categories}
          onSaved={onPatch}
        />
      </div>

      <Section label="Description">
        <EditableDescription task={task} onSaved={onPatch} />
      </Section>

      <MetaGrid task={task} onPatch={onPatch} />

      <Section label="People">
        <div className="space-y-2">
          <ReporterRow reporter={task.reporter} />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-muted-foreground">
              Assignees
            </p>
            <AssigneePicker
              task={task}
              members={members}
              onSaved={onPatch}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-muted-foreground">
              Watchers
            </p>
            <WatcherPicker
              task={task}
              members={members}
              onSaved={onPatch}
            />
          </div>
        </div>
      </Section>

      <Section label="Labels">
        <LabelPicker task={task} labels={labels} onSaved={onPatch} />
      </Section>

      {task.subtasks.length > 0 ? (
        <SubtasksBlock subtasks={task.subtasks} />
      ) : null}

      <Section
        label={`Checklists (${doneChecklistItems}/${totalChecklistItems})`}
      >
        <TaskChecklistsPanel
          taskId={task.id}
          checklists={checklists}
          onChanged={onRefetch}
        />
      </Section>

      <Section label={`Attachments (${attachments.length})`}>
        <TaskAttachmentsPanel
          taskId={task.id}
          attachments={attachments}
          onChanged={onRefetch}
        />
      </Section>

      <Section label={`Comments (${comments.length})`}>
        <TaskCommentsPanel
          taskId={task.id}
          comments={comments}
          currentUserId={currentUserId}
          onChanged={onRefetch}
        />
      </Section>

      <Section label={`Activity (${activity.length})`}>
        <TaskActivityPanel
          activity={activity}
          statusNameById={statusNameById}
          categoryNameById={categoryNameById}
          labelNameById={labelNameById}
          memberNameById={memberNameById}
        />
      </Section>
    </div>
  )
}

function MetaGrid({
  task,
  onPatch,
}: {
  task: TaskDetail
  onPatch: (patch: Partial<TaskDetail>) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/20 p-3">
      <MetaCell label="Start date">
        <EditableDate
          task={task}
          field="startDate"
          label="Start date"
          onSaved={onPatch}
        />
      </MetaCell>
      <MetaCell label="Due date">
        <EditableDate
          task={task}
          field="dueDate"
          label="Due date"
          onSaved={onPatch}
        />
      </MetaCell>
      <MetaCell label="Estimated hours">
        <EditableHours
          task={task}
          field="estimatedHours"
          label="Estimated hours"
          onSaved={onPatch}
        />
      </MetaCell>
      <MetaCell label="Actual hours">
        <EditableHours
          task={task}
          field="actualHours"
          label="Actual hours"
          onSaved={onPatch}
        />
      </MetaCell>
    </div>
  )
}

function MetaCell({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  )
}

function ReporterRow({ reporter }: { reporter: TaskUserRef | null }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs font-medium text-muted-foreground">Reporter</p>
      {reporter ? (
        <div className="flex items-center gap-2">
          <AvatarGroup
            users={[
              {
                name: reporter.name ?? reporter.email,
                avatarUrl: null,
              },
            ]}
            size="sm"
            max={1}
          />
          <span className="text-xs text-muted-foreground">
            {reporter.name ?? reporter.email.split('@')[0]}
          </span>
        </div>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <User className="size-3" aria-hidden />
          System
        </span>
      )}
    </div>
  )
}

function SubtasksBlock({
  subtasks,
}: {
  subtasks: TaskDetail['subtasks']
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


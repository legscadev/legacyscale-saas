'use client'

// Multi-select popovers for assignees / watchers / labels on the
// task detail drawer. Each is a thin wrapper around a shared
// searchable checkbox list.
//
// UX intent: the drawer already shows the current selections
// (avatar stack for people, chip row for labels). Clicking the
// section chrome opens the picker. Ticking an option fires the
// server action + optimistically patches the local task state,
// same pattern the scalar fields use.

import { useMemo, useState, useTransition } from 'react'
import { Check, Search, User, Users } from 'lucide-react'
import { toast } from 'sonner'

import {
  setAssigneesAction,
  setWatchersAction,
  updateTaskAction,
  type TeamMember,
  type WorkflowLabel,
} from '@/app/(admin)/admin/tasks/actions'
import { AvatarGroup } from '@/components/shared/avatar-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { TaskDetail, TaskUserRef } from '@/lib/services/task-service'

import { LabelChip } from './task-pills'

// =========================================================
// Generic searchable multi-select popover
// =========================================================

interface MultiSelectOption {
  id: string
  label: string
  /** Optional right-aligned meta text (e.g. email). */
  meta?: string
  /** Optional avatar/name for the leading dot (used by people). */
  avatarName?: string | null
  /** Optional color swatch (used by labels). */
  color?: string
}

interface MultiSelectPopoverProps {
  trigger: React.ReactNode
  options: MultiSelectOption[]
  selected: string[]
  onToggle: (id: string, checked: boolean) => void
  emptyLabel?: string
  searchPlaceholder?: string
  disabled?: boolean
  /** Stretch the trigger button to fill its container — used by
   *  the label picker so the whole row is clickable. */
  fullWidth?: boolean
}

function MultiSelectPopover({
  trigger,
  options,
  selected,
  onToggle,
  emptyLabel = 'No results.',
  searchPlaceholder = 'Search…',
  disabled,
  fullWidth,
}: MultiSelectPopoverProps) {
  const [query, setQuery] = useState('')
  const selectedSet = useMemo(() => new Set(selected), [selected])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.meta?.toLowerCase().includes(q) ?? false),
    )
  }, [options, query])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <button
            type="button"
            className={cn(
              'rounded-md border border-transparent px-1.5 py-1 text-left transition-colors',
              'hover:border-border hover:bg-muted/40 disabled:opacity-50',
              fullWidth && 'w-full',
            )}
          />
        }
      >
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-0">
        <div className="border-b p-2">
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 pl-7 text-sm"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-64 overflow-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              {emptyLabel}
            </p>
          ) : (
            filtered.map((opt) => {
              const checked = selectedSet.has(opt.id)
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onToggle(opt.id, !checked)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <div
                    className={cn(
                      'flex size-4 shrink-0 items-center justify-center rounded-sm border',
                      checked
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input',
                    )}
                  >
                    {checked ? <Check className="size-3" /> : null}
                  </div>
                  {opt.color ? (
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: opt.color }}
                      aria-hidden
                    />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                  {opt.meta ? (
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {opt.meta}
                    </span>
                  ) : null}
                </button>
              )
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// =========================================================
// Assignee picker
// =========================================================

interface PeoplePickerProps {
  task: TaskDetail
  members: TeamMember[]
  onSaved: (patch: Partial<TaskDetail>) => void
}

export function AssigneePicker({
  task,
  members,
  onSaved,
}: PeoplePickerProps) {
  const [, startSave] = useTransition()
  const selected = task.assignees.map((a) => a.id)

  function toggle(userId: string, checked: boolean) {
    const nextIds = checked
      ? [...selected, userId]
      : selected.filter((id) => id !== userId)
    const nextAssignees = memberIdsToRefs(nextIds, members)
    startSave(async () => {
      const res = await setAssigneesAction({
        taskId: task.id,
        userIds: nextIds,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not update assignees')
        return
      }
      onSaved({ assignees: nextAssignees })
    })
  }

  return (
    <MultiSelectPopover
      trigger={
        <span className="inline-flex items-center gap-2">
          {task.assignees.length === 0 ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <User className="size-3" aria-hidden />
              Unassigned
            </span>
          ) : (
            <>
              <AvatarGroup
                users={task.assignees.map((p) => ({
                  name: p.name ?? p.email,
                  avatarUrl: null,
                }))}
                size="sm"
                max={5}
              />
              <span className="text-xs text-muted-foreground">
                {task.assignees.length} assigned
              </span>
            </>
          )}
        </span>
      }
      options={members.map((m) => ({
        id: m.id,
        label: m.name ?? m.email,
        meta: m.email,
      }))}
      selected={selected}
      onToggle={toggle}
      searchPlaceholder="Search team…"
      emptyLabel="No team members found."
    />
  )
}

// =========================================================
// Watcher picker
// =========================================================

export function WatcherPicker({
  task,
  members,
  onSaved,
}: PeoplePickerProps) {
  const [, startSave] = useTransition()
  const selected = task.watchers.map((w) => w.id)

  function toggle(userId: string, checked: boolean) {
    const nextIds = checked
      ? [...selected, userId]
      : selected.filter((id) => id !== userId)
    const nextWatchers = memberIdsToRefs(nextIds, members)
    startSave(async () => {
      const res = await setWatchersAction({
        taskId: task.id,
        userIds: nextIds,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not update watchers')
        return
      }
      onSaved({ watchers: nextWatchers })
    })
  }

  return (
    <MultiSelectPopover
      trigger={
        <span className="inline-flex items-center gap-2">
          {task.watchers.length === 0 ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="size-3" aria-hidden />
              No watchers
            </span>
          ) : (
            <>
              <AvatarGroup
                users={task.watchers.map((p) => ({
                  name: p.name ?? p.email,
                  avatarUrl: null,
                }))}
                size="sm"
                max={5}
              />
              <span className="text-xs text-muted-foreground">
                {task.watchers.length} watching
              </span>
            </>
          )}
        </span>
      }
      options={members.map((m) => ({
        id: m.id,
        label: m.name ?? m.email,
        meta: m.email,
      }))}
      selected={selected}
      onToggle={toggle}
      searchPlaceholder="Search team…"
      emptyLabel="No team members found."
    />
  )
}

// =========================================================
// Label picker
// =========================================================

interface LabelPickerProps {
  task: TaskDetail
  labels: WorkflowLabel[]
  onSaved: (patch: Partial<TaskDetail>) => void
}

export function LabelPicker({ task, labels, onSaved }: LabelPickerProps) {
  const [, startSave] = useTransition()
  const selected = task.labels.map((l) => l.id)

  function toggle(labelId: string, checked: boolean) {
    const nextIds = checked
      ? [...selected, labelId]
      : selected.filter((id) => id !== labelId)
    const nextLabels = nextIds
      .map((id) => labels.find((l) => l.id === id))
      .filter((l): l is WorkflowLabel => !!l)
    startSave(async () => {
      const res = await updateTaskAction(task.id, { labelIds: nextIds })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not update labels')
        return
      }
      onSaved({ labels: nextLabels })
    })
  }

  return (
    <MultiSelectPopover
      fullWidth
      trigger={
        task.labels.length === 0 ? (
          <span className="text-xs italic text-muted-foreground">
            Click to add labels
          </span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {task.labels.map((l) => (
              <LabelChip key={l.id} name={l.name} color={l.color} />
            ))}
          </span>
        )
      }
      options={labels.map((l) => ({
        id: l.id,
        label: l.name,
        color: l.color,
      }))}
      selected={selected}
      onToggle={toggle}
      searchPlaceholder="Search labels…"
      emptyLabel="No labels defined."
    />
  )
}

// =========================================================
// Helpers
// =========================================================

function memberIdsToRefs(
  ids: string[],
  members: TeamMember[],
): TaskUserRef[] {
  return ids
    .map((id) => {
      const m = members.find((x) => x.id === id)
      if (!m) return null
      return { id: m.id, name: m.name, email: m.email }
    })
    .filter((v): v is TaskUserRef => v !== null)
}


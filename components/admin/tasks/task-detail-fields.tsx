'use client'

// Inline-editable field components for the task detail drawer.
// Each field owns its own "editing" state; on save it fires
// updateTaskAction and lets the parent decide when to refetch
// (usually via router.refresh in the shell's onChanged path).
//
// Design principles:
//  - Optimistic: the parent state is updated as soon as the action
//    returns ok, without waiting for the workspace revalidate. Errors
//    roll back + toast.
//  - Enter to save / Escape to cancel on text inputs; blur commits.
//  - Selects (status/priority/category) fire on change, no manual save.
//  - The bare read view mimics the read-only design in 4.1 so
//    swapping between the two feels continuous.

import { format } from 'date-fns'
import { CalendarDays, Check, Pencil, X } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import {
  updateTaskAction,
  type WorkflowCategory,
  type WorkflowStatus,
} from '@/app/(admin)/admin/tasks/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { TaskDetail } from '@/lib/services/task-service'
import {
  TASK_PRIORITY_LABELS,
  type TaskPriorityValue,
} from '@/lib/validations/tasks'

import { PriorityPill, StatusPill } from './task-pills'

const NO_CATEGORY = '__none__'

interface CommonProps {
  task: TaskDetail
  onSaved: (patch: Partial<TaskDetail>) => void
}

// =========================================================
// TITLE
// =========================================================

export function EditableTitle({ task, onSaved }: CommonProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.title)
  const [isSaving, startSave] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  useEffect(() => {
    setDraft(task.title)
  }, [task.title])

  function commit() {
    const next = draft.trim()
    if (!next || next === task.title) {
      setDraft(task.title)
      setEditing(false)
      return
    }
    startSave(async () => {
      const res = await updateTaskAction(task.id, { title: next })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not save title')
        setDraft(task.title)
        setEditing(false)
        return
      }
      onSaved({ title: next })
      setEditing(false)
    })
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-full text-left text-base font-medium leading-snug transition-colors hover:text-primary"
      >
        {task.title}
      </button>
    )
  }

  return (
    <Input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        } else if (e.key === 'Escape') {
          setDraft(task.title)
          setEditing(false)
        }
      }}
      disabled={isSaving}
      className="text-base font-medium"
    />
  )
}

// =========================================================
// DESCRIPTION
// =========================================================

export function EditableDescription({ task, onSaved }: CommonProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.description ?? '')
  const [isSaving, startSave] = useTransition()

  useEffect(() => {
    setDraft(task.description ?? '')
  }, [task.description])

  function commit() {
    const next = draft.trim()
    const current = task.description ?? ''
    if (next === current) {
      setEditing(false)
      return
    }
    startSave(async () => {
      const res = await updateTaskAction(task.id, {
        description: next || null,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not save description')
        setDraft(current)
        setEditing(false)
        return
      }
      onSaved({ description: next || null })
      setEditing(false)
    })
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={cn(
          'group/desc block w-full rounded-md border border-transparent p-2 text-left transition-colors',
          'hover:border-border hover:bg-muted/40',
        )}
      >
        {task.description ? (
          <DescriptionHtml html={task.description} />
        ) : (
          <span className="text-sm italic text-muted-foreground">
            Click to add a description
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="space-y-2">
      <RichTextEditor
        value={draft}
        onChange={setDraft}
        placeholder="Add context, acceptance criteria, links…"
        disabled={isSaving}
        size="sm"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={commit} disabled={isSaving}>
          <Check className="size-3.5" />
          Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setDraft(task.description ?? '')
            setEditing(false)
          }}
          disabled={isSaving}
        >
          <X className="size-3.5" />
          Cancel
        </Button>
      </div>
    </div>
  )
}

/**
 * Read-view renderer for the stored rich-text HTML. Uses the same
 * .tiptap selector conventions the editor writes to so paragraphs,
 * headings, lists, blockquotes, and links look continuous between
 * edit and read modes.
 *
 * dangerouslySetInnerHTML is safe here because the HTML string is
 * produced by Tiptap's getHTML() (schema-escaped) and stored back
 * unchanged. When user-generated HTML surfaces on a member-facing
 * page we'll add a DOMPurify boundary — for the admin-only drawer
 * writer + reader are both trusted admins.
 */
function DescriptionHtml({ html }: { html: string }) {
  return (
    <div
      className={cn(
        'tiptap text-sm text-foreground',
        '[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
        '[&_h2]:text-base [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:mt-3 [&_h2]:mb-1',
        '[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:tracking-tight [&_h3]:mt-3 [&_h3]:mb-1',
        '[&_ul]:my-2 [&_ul]:pl-5 [&_ul]:list-disc',
        '[&_ol]:my-2 [&_ol]:pl-5 [&_ol]:list-decimal',
        '[&_li]:my-0.5',
        '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
        '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
        '[&_strong]:font-semibold [&_em]:italic',
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// =========================================================
// STATUS / PRIORITY / CATEGORY (fire-on-change selects)
// =========================================================

interface StatusFieldProps extends CommonProps {
  statuses: WorkflowStatus[]
}

export function EditableStatus({
  task,
  statuses,
  onSaved,
}: StatusFieldProps) {
  const [, startSave] = useTransition()

  function apply(nextId: string) {
    if (nextId === task.statusId) return
    startSave(async () => {
      const res = await updateTaskAction(task.id, { statusId: nextId })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not change status')
        return
      }
      const next = statuses.find((s) => s.id === nextId)
      if (next) {
        onSaved({
          statusId: nextId,
          status: {
            id: next.id,
            name: next.name,
            slug: next.slug,
            color: next.color,
            orderIndex: next.orderIndex,
            isTerminal: next.isTerminal,
          },
        })
      }
    })
  }

  return (
    <Select value={task.statusId} onValueChange={(v) => apply(v ?? '')}>
      <SelectTrigger className="h-auto border-transparent bg-transparent px-1 py-0.5 hover:bg-muted/60">
        <SelectValue>
          {() => (
            <StatusPill name={task.status.name} color={task.status.color} />
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {statuses.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            <span
              className="mr-1 inline-block size-2 rounded-full align-middle"
              style={{ backgroundColor: s.color }}
              aria-hidden
            />
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function EditablePriority({ task, onSaved }: CommonProps) {
  const [, startSave] = useTransition()
  function apply(next: string | null) {
    const nextPriority = (next ?? task.priority) as TaskPriorityValue
    if (nextPriority === task.priority) return
    startSave(async () => {
      const res = await updateTaskAction(task.id, { priority: nextPriority })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not change priority')
        return
      }
      onSaved({ priority: nextPriority })
    })
  }

  return (
    <Select value={task.priority} onValueChange={apply}>
      <SelectTrigger className="h-auto border-transparent bg-transparent px-1 py-0.5 hover:bg-muted/60">
        <SelectValue>
          {() => <PriorityPill priority={task.priority} />}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {(
          Object.entries(TASK_PRIORITY_LABELS) as Array<
            [TaskPriorityValue, string]
          >
        ).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

interface CategoryFieldProps extends CommonProps {
  categories: WorkflowCategory[]
}

export function EditableCategory({
  task,
  categories,
  onSaved,
}: CategoryFieldProps) {
  const [, startSave] = useTransition()
  const value = task.categoryId ?? NO_CATEGORY

  function apply(next: string | null) {
    const nextValue = next ?? NO_CATEGORY
    if (nextValue === value) return
    const nextCategoryId = nextValue === NO_CATEGORY ? null : nextValue
    startSave(async () => {
      const res = await updateTaskAction(task.id, {
        categoryId: nextCategoryId,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not change category')
        return
      }
      const next = nextCategoryId
        ? categories.find((c) => c.id === nextCategoryId) ?? null
        : null
      onSaved({
        categoryId: nextCategoryId,
        category: next
          ? { id: next.id, name: next.name, color: next.color }
          : null,
      })
    })
  }

  return (
    <Select value={value} onValueChange={apply}>
      <SelectTrigger className="h-auto border-transparent bg-transparent px-1 py-0.5 hover:bg-muted/60">
        <SelectValue>
          {(v: string) => {
            if (v === NO_CATEGORY) {
              return (
                <span className="text-xs italic text-muted-foreground">
                  No category
                </span>
              )
            }
            const c = categories.find((cat) => cat.id === v)
            if (!c) return null
            return (
              <span
                className="rounded-md border px-1.5 py-0.5 text-[11px] font-medium"
                style={{
                  backgroundColor: `${c.color}14`,
                  borderColor: `${c.color}66`,
                  color: c.color,
                }}
              >
                {c.name}
              </span>
            )
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_CATEGORY}>No category</SelectItem>
        {categories.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// =========================================================
// DATE / NUMBER FIELDS (edit-in-place)
// =========================================================

interface EditableDateProps extends CommonProps {
  field: 'startDate' | 'dueDate'
  label: string
}

export function EditableDate({
  task,
  field,
  label,
  onSaved,
}: EditableDateProps) {
  const current = task[field]
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(
    current ? format(current, 'yyyy-MM-dd') : '',
  )
  const [isSaving, startSave] = useTransition()

  useEffect(() => {
    setDraft(current ? format(current, 'yyyy-MM-dd') : '')
  }, [current])

  function commit() {
    const nextIso = draft.trim()
    const currentIso = current ? format(current, 'yyyy-MM-dd') : ''
    if (nextIso === currentIso) {
      setEditing(false)
      return
    }
    startSave(async () => {
      const res = await updateTaskAction(task.id, {
        [field]: nextIso || '',
      })
      if (!res.ok) {
        toast.error(res.error ?? `Could not update ${label.toLowerCase()}`)
        setDraft(currentIso)
        setEditing(false)
        return
      }
      onSaved({ [field]: nextIso ? new Date(nextIso) : null })
      setEditing(false)
    })
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-sm text-foreground tabular-nums transition-colors hover:bg-muted/60"
      >
        <CalendarDays
          className="size-3.5 text-muted-foreground"
          aria-hidden
        />
        {current ? format(current, 'MMM d, yyyy') : (
          <span className="italic text-muted-foreground">Set date</span>
        )}
      </button>
    )
  }

  return (
    <Input
      type="date"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        } else if (e.key === 'Escape') {
          setDraft(current ? format(current, 'yyyy-MM-dd') : '')
          setEditing(false)
        }
      }}
      disabled={isSaving}
      autoFocus
      className="h-8 text-sm"
    />
  )
}

interface EditableHoursProps extends CommonProps {
  field: 'estimatedHours' | 'actualHours'
  label: string
}

export function EditableHours({
  task,
  field,
  label,
  onSaved,
}: EditableHoursProps) {
  const current = task[field]
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(current !== null ? String(current) : '')
  const [isSaving, startSave] = useTransition()

  useEffect(() => {
    setDraft(current !== null ? String(current) : '')
  }, [current])

  function commit() {
    const trimmed = draft.trim()
    const nextValue = trimmed === '' ? null : Number(trimmed)
    if (
      nextValue !== null &&
      (Number.isNaN(nextValue) || nextValue < 0 || nextValue > 10000)
    ) {
      toast.error('Hours must be between 0 and 10000')
      setDraft(current !== null ? String(current) : '')
      setEditing(false)
      return
    }
    if (nextValue === current) {
      setEditing(false)
      return
    }
    startSave(async () => {
      const res = await updateTaskAction(task.id, {
        [field]: nextValue,
      })
      if (!res.ok) {
        toast.error(res.error ?? `Could not update ${label.toLowerCase()}`)
        setDraft(current !== null ? String(current) : '')
        setEditing(false)
        return
      }
      onSaved({ [field]: nextValue })
      setEditing(false)
    })
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-sm text-foreground tabular-nums transition-colors hover:bg-muted/60"
      >
        {current !== null ? `${current}h` : (
          <span className="inline-flex items-center gap-1 italic text-muted-foreground">
            <Pencil className="size-3" aria-hidden />
            Set
          </span>
        )}
      </button>
    )
  }

  return (
    <Input
      type="number"
      min={0}
      max={10000}
      step={0.25}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        } else if (e.key === 'Escape') {
          setDraft(current !== null ? String(current) : '')
          setEditing(false)
        }
      }}
      disabled={isSaving}
      autoFocus
      className="h-8 w-24 text-sm"
    />
  )
}

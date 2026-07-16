'use client'

// Create-task dialog. Kept intentionally scoped to the fields the
// list view needs at creation time — title, description, status,
// priority, category, due date. Assignees / watchers / labels are
// editable from the detail drawer (Phase 4) so the create form
// stays focused on "get a row in".

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import {
  createTaskAction,
  type WorkflowCategory,
  type WorkflowStatus,
} from '@/app/(admin)/admin/tasks/actions'
import { TASK_PRIORITY_LABELS } from '@/lib/validations/tasks'

type PriorityValue = keyof typeof TASK_PRIORITY_LABELS

interface CreateTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void | Promise<void>
  statuses: WorkflowStatus[]
  categories: WorkflowCategory[]
}

// Sentinel value used by the "no category" option. Radix Select
// rejects an empty-string value so we swap in / out here.
const NO_CATEGORY = '__none__'

export function CreateTaskDialog({
  open,
  onOpenChange,
  onCreated,
  statuses,
  categories,
}: CreateTaskDialogProps) {
  const defaultStatus =
    statuses.find((s) => s.isDefault) ?? statuses[0] ?? null

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [statusId, setStatusId] = useState(defaultStatus?.id ?? '')
  const [priority, setPriority] = useState<PriorityValue>('MEDIUM')
  const [categoryId, setCategoryId] = useState<string>(NO_CATEGORY)
  const [dueDate, setDueDate] = useState('')

  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, startSave] = useTransition()

  function resetForm() {
    setTitle('')
    setDescription('')
    setStatusId(defaultStatus?.id ?? '')
    setPriority('MEDIUM')
    setCategoryId(NO_CATEGORY)
    setDueDate('')
    setErrors({})
    setFormError(null)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors({})
    setFormError(null)

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setErrors({ title: ['Title is required'] })
      return
    }

    startSave(async () => {
      const result = await createTaskAction({
        title: trimmedTitle,
        description: description.trim() || null,
        statusId: statusId || undefined,
        priority,
        categoryId: categoryId === NO_CATEGORY ? null : categoryId,
        dueDate: dueDate || '',
        assigneeIds: [],
        watcherIds: [],
        labelIds: [],
      })

      if (!result.ok) {
        if (result.fieldErrors) setErrors(result.fieldErrors)
        if (result.error) setFormError(result.error)
        return
      }

      toast.success('Task created')
      resetForm()
      await onCreated()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetForm()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            Add a task to your team&apos;s tracker. You can assign people
            and tag labels from the task itself.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Migrate the billing service"
              disabled={isSaving}
              autoFocus
              aria-invalid={!!errors.title}
            />
            {errors.title?.[0] ? (
              <p className="text-xs text-destructive">{errors.title[0]}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional. Add context, acceptance criteria, links."
              rows={4}
              disabled={isSaving}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="task-status">Status</Label>
              <Select
                value={statusId}
                onValueChange={(v) => setStatusId(v ?? '')}
                disabled={isSaving}
              >
                <SelectTrigger id="task-status">
                  <SelectValue placeholder="Pick a status">
                    {(v: string) =>
                      statuses.find((s) => s.id === v)?.name ?? ''
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-priority">Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as PriorityValue)}
                disabled={isSaving}
              >
                <SelectTrigger id="task-priority">
                  <SelectValue>
                    {(v: string) =>
                      TASK_PRIORITY_LABELS[v as PriorityValue] ?? ''
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.entries(TASK_PRIORITY_LABELS) as Array<
                      [PriorityValue, string]
                    >
                  ).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-category">Category</Label>
              <Select
                value={categoryId}
                onValueChange={(v) => setCategoryId(v ?? NO_CATEGORY)}
                disabled={isSaving}
              >
                <SelectTrigger id="task-category">
                  <SelectValue>
                    {(v: string) =>
                      v === NO_CATEGORY
                        ? 'None'
                        : categories.find((c) => c.id === v)?.name ?? 'None'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CATEGORY}>None</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-due">Due date</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={isSaving}
              />
            </div>
          </div>

          {formError ? (
            <p className="text-sm text-destructive">{formError}</p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !statusId}>
              {isSaving ? 'Creating…' : 'Create task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

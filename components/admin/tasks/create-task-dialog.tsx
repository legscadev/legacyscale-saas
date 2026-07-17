'use client'

// Create-task dialog. Jira-style two-column layout: content on the
// left (title, description, attachments), metadata sidebar on the
// right (status, priority, due date, category, assignees, labels).
//
// Attachments are a two-phase submit: create the task, then fan
// out per-file uploads + per-link registrations against the new
// task_id. Per-attachment failures toast but don't roll back the
// task itself.

import {
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import {
  Check,
  ExternalLink,
  Flag,
  Folder,
  Link2,
  Paperclip,
  Search,
  Tag,
  Upload,
  UserCircle,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { AvatarGroup } from '@/components/shared/avatar-group'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { cn } from '@/lib/utils'

import {
  createTaskAction,
  registerTaskLinkAttachmentAction,
  uploadTaskAttachmentAction,
  type TeamMember,
  type WorkflowCategory,
  type WorkflowLabel,
  type WorkflowStatus,
} from '@/app/(admin)/admin/tasks/actions'
import { TASK_PRIORITY_LABELS } from '@/lib/validations/tasks'

import { LabelChip, PriorityPill, StatusPill } from './task-pills'

const MAX_ATTACHMENT_MB = 10

type PriorityValue = keyof typeof TASK_PRIORITY_LABELS

interface CreateTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void | Promise<void>
  statuses: WorkflowStatus[]
  categories: WorkflowCategory[]
  labels: WorkflowLabel[]
  members: TeamMember[]
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  onCreated,
  statuses,
  categories,
  labels,
  members,
}: CreateTaskDialogProps) {
  const defaultStatus =
    statuses.find((s) => s.isDefault) ?? statuses[0] ?? null

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [statusId, setStatusId] = useState<string>(defaultStatus?.id ?? '')
  const [priority, setPriority] = useState<PriorityValue>('MEDIUM')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [dueDate, setDueDate] = useState('')
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [labelIds, setLabelIds] = useState<string[]>([])
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [pendingLinks, setPendingLinks] = useState<
    Array<{ name: string; url: string }>
  >([])

  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, startSave] = useTransition()

  function resetForm() {
    setTitle('')
    setDescription('')
    setStatusId(defaultStatus?.id ?? '')
    setPriority('MEDIUM')
    setCategoryId(null)
    setDueDate('')
    setAssigneeIds([])
    setLabelIds([])
    setPendingFiles([])
    setPendingLinks([])
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
      const desc = description.trim()
      const normalizedDesc =
        !desc || desc === '<p></p>' ? null : desc

      const result = await createTaskAction({
        title: trimmedTitle,
        description: normalizedDesc,
        statusId: statusId || undefined,
        priority,
        categoryId,
        dueDate: dueDate || '',
        assigneeIds,
        watcherIds: [],
        labelIds,
      })

      if (!result.ok) {
        if (result.fieldErrors) setErrors(result.fieldErrors)
        if (result.error) setFormError(result.error)
        return
      }

      // Two-phase attachment submit. Per-attachment failures toast
      // individually; the task itself stays created.
      const taskId = result.data.id
      const jobs: Array<Promise<unknown>> = []
      for (const file of pendingFiles) {
        const fd = new FormData()
        fd.set('taskId', taskId)
        fd.set('file', file)
        jobs.push(
          uploadTaskAttachmentAction(fd).then((res) => {
            if (!res.ok) {
              toast.error(`"${file.name}" upload failed: ${res.error ?? 'unknown error'}`)
            }
          }),
        )
      }
      for (const link of pendingLinks) {
        jobs.push(
          registerTaskLinkAttachmentAction({
            taskId,
            name: link.name,
            url: link.url,
          }).then((res) => {
            if (!res.ok) {
              toast.error(`Link "${link.name || link.url}" failed: ${res.error ?? 'unknown error'}`)
            }
          }),
        )
      }
      if (jobs.length > 0) await Promise.all(jobs)

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
      <DialogContent className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b p-5">
          <DialogTitle>Create task</DialogTitle>
          <DialogDescription className="sr-only">
            Create a task in your team&apos;s tracker.
          </DialogDescription>
        </DialogHeader>

        <form
          id="create-task-form"
          onSubmit={handleSubmit}
          className="grid max-h-[calc(92vh-14rem)] grid-cols-1 gap-0 overflow-hidden sm:grid-cols-[minmax(0,1fr)_260px]"
        >
          {/* Left column — content. */}
          <div className="min-w-0 space-y-5 overflow-y-auto border-b p-5 sm:border-b-0 sm:border-r">
            <FieldRow label="Summary" required error={errors.title?.[0]}>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                disabled={isSaving}
                autoFocus
                aria-invalid={!!errors.title}
              />
            </FieldRow>

            <FieldRow label="Description">
              <RichTextEditor
                value={description}
                onChange={setDescription}
                placeholder="Add a description…"
                disabled={isSaving}
                size="sm"
              />
            </FieldRow>

            <FieldRow label="Attachments">
              <AttachmentBuffer
                files={pendingFiles}
                links={pendingLinks}
                onFilesChange={setPendingFiles}
                onLinksChange={setPendingLinks}
                disabled={isSaving}
              />
            </FieldRow>
          </div>

          {/* Right sidebar — metadata. */}
          <aside className="space-y-4 overflow-y-auto bg-muted/20 p-5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Details
            </p>

            <SidebarField label="Status">
              <StatusField
                statuses={statuses}
                value={statusId}
                onChange={setStatusId}
                disabled={isSaving}
              />
            </SidebarField>

            <SidebarField label="Priority">
              <PriorityField
                value={priority}
                onChange={setPriority}
                disabled={isSaving}
              />
            </SidebarField>

            <SidebarField label="Due date">
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={isSaving}
                className="h-9 text-sm"
              />
              {dueDate ? (
                <button
                  type="button"
                  onClick={() => setDueDate('')}
                  className="mt-1 text-[11px] text-muted-foreground hover:text-destructive"
                >
                  Clear
                </button>
              ) : null}
            </SidebarField>

            <SidebarField label="Category">
              <CategoryField
                categories={categories}
                value={categoryId}
                onChange={setCategoryId}
                disabled={isSaving}
              />
            </SidebarField>

            <SidebarField label="Assignees">
              <AssigneesField
                members={members}
                value={assigneeIds}
                onChange={setAssigneeIds}
                disabled={isSaving}
              />
            </SidebarField>

            <SidebarField label="Labels">
              <LabelsField
                labels={labels}
                value={labelIds}
                onChange={setLabelIds}
                disabled={isSaving}
              />
            </SidebarField>
          </aside>
        </form>

        {formError ? (
          <p className="border-t px-5 pt-3 text-sm text-destructive">
            {formError}
          </p>
        ) : null}

        <DialogFooter className="border-t bg-background p-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            // The footer sits outside the form (keeps the two-
            // column grid clean); the `form` attribute wires the
            // submit button to the outer <form id="create-task-form">.
            type="submit"
            form="create-task-form"
            disabled={isSaving || !statusId || !title.trim()}
          >
            {isSaving ? 'Creating…' : 'Create task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =========================================================
// Left-column field row — label on top, control below. Mirrors
// Jira's create-issue layout: field label + optional required
// marker + inline error.
// =========================================================

function FieldRow({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

/** Right-sidebar field — tighter, always compact. */
function SidebarField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

// =========================================================
// Metadata fields — each renders a click-to-open picker sized for
// the right sidebar (full-width trigger, dropdown flush left).
// =========================================================

function StatusField({
  statuses,
  value,
  onChange,
  disabled,
}: {
  statuses: WorkflowStatus[]
  value: string
  onChange: (id: string) => void
  disabled?: boolean
}) {
  const current = statuses.find((s) => s.id === value)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <button
            type="button"
            className={cn(
              'flex h-9 w-full items-center gap-2 rounded-md border bg-background px-3 text-left text-sm shadow-xs',
              'hover:bg-accent hover:text-foreground disabled:opacity-50',
            )}
          />
        }
      >
        {current ? (
          <StatusPill name={current.name} color={current.color} />
        ) : (
          <span className="text-muted-foreground">Select status</span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 p-1">
        {statuses.map((s) => (
          <DropdownMenuItem
            key={s.id}
            onClick={() => onChange(s.id)}
            className="gap-2"
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate">{s.name}</span>
            {value === s.id ? <Check className="size-3.5 text-primary" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function PriorityField({
  value,
  onChange,
  disabled,
}: {
  value: PriorityValue
  onChange: (next: PriorityValue) => void
  disabled?: boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <button
            type="button"
            className={cn(
              'flex h-9 w-full items-center gap-2 rounded-md border bg-background px-3 text-left text-sm shadow-xs',
              'hover:bg-accent hover:text-foreground disabled:opacity-50',
            )}
          />
        }
      >
        <PriorityPill priority={value} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44 p-1">
        {(Object.entries(TASK_PRIORITY_LABELS) as Array<[PriorityValue, string]>).map(
          ([val, label]) => (
            <DropdownMenuItem
              key={val}
              onClick={() => onChange(val)}
              className="gap-2"
            >
              <Flag className="size-3 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {value === val ? <Check className="size-3.5 text-primary" /> : null}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function CategoryField({
  categories,
  value,
  onChange,
  disabled,
}: {
  categories: WorkflowCategory[]
  value: string | null
  onChange: (id: string | null) => void
  disabled?: boolean
}) {
  const current = categories.find((c) => c.id === value)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <button
            type="button"
            className={cn(
              'flex h-9 w-full items-center gap-2 rounded-md border bg-background px-3 text-left text-sm shadow-xs',
              'hover:bg-accent hover:text-foreground disabled:opacity-50',
            )}
          />
        }
      >
        {current ? (
          <>
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: current.color }}
              aria-hidden
            />
            {current.name}
          </>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Folder className="size-3.5" />
            None
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 p-1">
        <DropdownMenuItem
          onClick={() => onChange(null)}
          className="gap-2 text-muted-foreground"
        >
          <span className="size-2 rounded-full border" aria-hidden />
          <span className="min-w-0 flex-1">No category</span>
          {value === null ? (
            <Check className="size-3.5 text-primary" />
          ) : null}
        </DropdownMenuItem>
        {categories.map((c) => (
          <DropdownMenuItem
            key={c.id}
            onClick={() => onChange(c.id)}
            className="gap-2"
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: c.color }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate">{c.name}</span>
            {value === c.id ? (
              <Check className="size-3.5 text-primary" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AssigneesField({
  members,
  value,
  onChange,
  disabled,
}: {
  members: TeamMember[]
  value: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}) {
  const [query, setQuery] = useState('')
  const selectedSet = useMemo(() => new Set(value), [value])
  const selectedMembers = members.filter((m) => selectedSet.has(m.id))
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return members
    return members.filter(
      (m) =>
        (m.name?.toLowerCase().includes(q) ?? false) ||
        m.email.toLowerCase().includes(q),
    )
  }, [members, query])

  function toggle(id: string) {
    onChange(
      selectedSet.has(id) ? value.filter((v) => v !== id) : [...value, id],
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <button
            type="button"
            className={cn(
              'flex min-h-9 w-full items-center gap-2 rounded-md border bg-background px-3 py-1 text-left text-sm shadow-xs',
              'hover:bg-accent hover:text-foreground disabled:opacity-50',
            )}
          />
        }
      >
        {selectedMembers.length === 0 ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <UserCircle className="size-3.5" />
            Unassigned
          </span>
        ) : (
          <>
            <AvatarGroup
              users={selectedMembers.map((m) => ({
                name: m.name ?? m.email,
                avatarUrl: null,
              }))}
              size="sm"
              max={3}
            />
            <span className="min-w-0 truncate text-muted-foreground">
              {selectedMembers.length === 1
                ? selectedMembers[0]?.name ??
                  selectedMembers[0]?.email.split('@')[0]
                : `${selectedMembers.length} assignees`}
            </span>
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-0">
        <div className="border-b p-2">
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search team…"
              className="h-8 pl-7 text-sm"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-60 overflow-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              No team members found.
            </p>
          ) : (
            filtered.map((m) => {
              const checked = selectedSet.has(m.id)
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.id)}
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
                  <span className="min-w-0 flex-1 truncate">
                    {m.name ?? m.email}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function LabelsField({
  labels,
  value,
  onChange,
  disabled,
}: {
  labels: WorkflowLabel[]
  value: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}) {
  const [query, setQuery] = useState('')
  const selectedSet = useMemo(() => new Set(value), [value])
  const selectedLabels = labels.filter((l) => selectedSet.has(l.id))
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return labels
    return labels.filter((l) => l.name.toLowerCase().includes(q))
  }, [labels, query])

  function toggle(id: string) {
    onChange(
      selectedSet.has(id) ? value.filter((v) => v !== id) : [...value, id],
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <button
            type="button"
            className={cn(
              'flex min-h-9 w-full items-center gap-2 rounded-md border bg-background px-3 py-1 text-left text-sm shadow-xs',
              'hover:bg-accent hover:text-foreground disabled:opacity-50',
            )}
          />
        }
      >
        {selectedLabels.length === 0 ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Tag className="size-3.5" />
            No labels
          </span>
        ) : (
          <div className="flex flex-wrap items-center gap-1">
            {selectedLabels.map((l) => (
              <LabelChip key={l.id} name={l.name} color={l.color} />
            ))}
          </div>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-0">
        <div className="border-b p-2">
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search labels…"
              className="h-8 pl-7 text-sm"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-60 overflow-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              No labels found.
            </p>
          ) : (
            filtered.map((l) => {
              const checked = selectedSet.has(l.id)
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => toggle(l.id)}
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
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: l.color }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">{l.name}</span>
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
// Attachment buffer — local File[] + link[] until we have a
// task_id to associate them with. Drag-and-drop supported.
// =========================================================

interface AttachmentBufferProps {
  files: File[]
  links: Array<{ name: string; url: string }>
  onFilesChange: (files: File[]) => void
  onLinksChange: (links: Array<{ name: string; url: string }>) => void
  disabled?: boolean
}

function AttachmentBuffer({
  files,
  links,
  onFilesChange,
  onLinksChange,
  disabled,
}: AttachmentBufferProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [linkFormOpen, setLinkFormOpen] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  function handleFiles(picked: FileList | null) {
    if (!picked || picked.length === 0) return
    const accepted: File[] = []
    for (const f of Array.from(picked)) {
      if (f.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
        toast.error(
          `"${f.name}" is ${(f.size / 1024 / 1024).toFixed(1)} MB — max ${MAX_ATTACHMENT_MB} MB.`,
        )
        continue
      }
      accepted.push(f)
    }
    if (accepted.length > 0) onFilesChange([...files, ...accepted])
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    if (disabled) return
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    if (!isDragOver) setIsDragOver(true)
  }
  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setIsDragOver(false)
  }
  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    if (disabled) return
    e.preventDefault()
    setIsDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  const hasAny = files.length > 0 || links.length > 0

  return (
    <div
      className={cn(
        'space-y-2 rounded-md border border-dashed p-3 transition-colors',
        isDragOver ? 'border-primary/60 bg-primary/5' : 'border-border/60',
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {hasAny ? (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li
              key={`f-${i}-${f.name}`}
              className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1 text-sm"
            >
              <Paperclip
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {formatBytes(f.size)}
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                type="button"
                onClick={() =>
                  onFilesChange(files.filter((_, idx) => idx !== i))
                }
                disabled={disabled}
                aria-label={`Remove ${f.name}`}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
          {links.map((l, i) => (
            <li
              key={`l-${i}-${l.url}`}
              className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1 text-sm"
            >
              <Link2
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate">
                {l.name || safeHost(l.url)}
              </span>
              <ExternalLink
                className="size-3 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <Button
                size="icon-sm"
                variant="ghost"
                type="button"
                onClick={() =>
                  onLinksChange(links.filter((_, idx) => idx !== i))
                }
                disabled={disabled}
                aria-label={`Remove ${l.name || l.url}`}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          {isDragOver
            ? `Drop to attach — up to ${MAX_ATTACHMENT_MB} MB per file`
            : `Drop files here or use the buttons. Max ${MAX_ATTACHMENT_MB} MB each.`}
        </p>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            className="h-7 text-xs"
          >
            <Upload className="size-3.5" />
            Upload files
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setLinkFormOpen((v) => !v)}
            disabled={disabled}
            className="h-7 text-xs"
          >
            <Link2 className="size-3.5" />
            Add link
          </Button>
        </div>
      </div>

      {linkFormOpen ? (
        <PendingLinkForm
          onCancel={() => setLinkFormOpen(false)}
          onAdd={(next) => {
            onLinksChange([...links, next])
            setLinkFormOpen(false)
          }}
          disabled={disabled}
        />
      ) : null}
    </div>
  )
}

interface PendingLinkFormProps {
  onCancel: () => void
  onAdd: (next: { name: string; url: string }) => void
  disabled?: boolean
}

function PendingLinkForm({ onCancel, onAdd, disabled }: PendingLinkFormProps) {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')

  function commit() {
    const trimmedUrl = url.trim()
    if (!trimmedUrl) return
    try {
      const parsed = new URL(trimmedUrl)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        toast.error('URL must start with http:// or https://')
        return
      }
    } catch {
      toast.error('Invalid URL')
      return
    }
    onAdd({ name: name.trim(), url: trimmedUrl })
  }

  return (
    <div className="space-y-2 rounded-md border bg-background p-2">
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://drive.google.com/… or https://figma.com/…"
        type="url"
        disabled={disabled}
        autoFocus
        className="h-8 text-sm"
      />
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Display name (optional — defaults to the URL host)"
        disabled={disabled}
        className="h-8 text-sm"
      />
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancel}
          disabled={disabled}
        >
          <X className="size-3.5" />
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={commit}
          disabled={disabled || !url.trim()}
        >
          Save link
        </Button>
      </div>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function safeHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}


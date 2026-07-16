'use client'

// Create-task dialog. Covers title, description (rich text),
// status, priority, category, assignees, due date, and attachments
// (files + links). Labels + watchers still live on the drawer.
//
// Attachments are inherently a two-phase submit — we need a
// task_id before we can write a task_attachment. On save we
// create the task first, then upload buffered files / register
// buffered link URLs in parallel; per-attachment failures surface
// as separate toasts but don't roll back the task.

import { useMemo, useRef, useState, useTransition } from 'react'
import {
  Check,
  ExternalLink,
  Link2,
  Paperclip,
  Search,
  Upload,
  Users,
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

import {
  createTaskAction,
  registerTaskLinkAttachmentAction,
  uploadTaskAttachmentAction,
  type TeamMember,
  type WorkflowCategory,
  type WorkflowStatus,
} from '@/app/(admin)/admin/tasks/actions'
import { TASK_PRIORITY_LABELS } from '@/lib/validations/tasks'

const MAX_ATTACHMENT_MB = 10

type PriorityValue = keyof typeof TASK_PRIORITY_LABELS

interface CreateTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void | Promise<void>
  statuses: WorkflowStatus[]
  categories: WorkflowCategory[]
  members: TeamMember[]
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
  members,
}: CreateTaskDialogProps) {
  const defaultStatus =
    statuses.find((s) => s.isDefault) ?? statuses[0] ?? null

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [statusId, setStatusId] = useState(defaultStatus?.id ?? '')
  const [priority, setPriority] = useState<PriorityValue>('MEDIUM')
  const [categoryId, setCategoryId] = useState<string>(NO_CATEGORY)
  const [dueDate, setDueDate] = useState('')
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
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
    setCategoryId(NO_CATEGORY)
    setDueDate('')
    setAssigneeIds([])
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
      // Description is stored as HTML from Tiptap; empty-doc case
      // is either '' or '<p></p>' — normalize both to null.
      const desc = description.trim()
      const normalizedDesc =
        !desc || desc === '<p></p>' ? null : desc

      const result = await createTaskAction({
        title: trimmedTitle,
        description: normalizedDesc,
        statusId: statusId || undefined,
        priority,
        categoryId: categoryId === NO_CATEGORY ? null : categoryId,
        dueDate: dueDate || '',
        assigneeIds,
        watcherIds: [],
        labelIds: [],
      })

      if (!result.ok) {
        if (result.fieldErrors) setErrors(result.fieldErrors)
        if (result.error) setFormError(result.error)
        return
      }

      // Task created. Fan out attachment work — task-id is required
      // (we can't write task_attachment rows without it), so this
      // is a two-phase flow. Per-attachment failures surface as
      // toasts but don't roll back the task itself.
      const taskId = result.data.id
      const attachmentJobs: Array<Promise<unknown>> = []
      for (const file of pendingFiles) {
        const fd = new FormData()
        fd.set('taskId', taskId)
        fd.set('file', file)
        attachmentJobs.push(
          uploadTaskAttachmentAction(fd).then((res) => {
            if (!res.ok) {
              toast.error(`"${file.name}" upload failed: ${res.error ?? 'unknown error'}`)
            }
          }),
        )
      }
      for (const link of pendingLinks) {
        attachmentJobs.push(
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
      if (attachmentJobs.length > 0) await Promise.all(attachmentJobs)

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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
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
            <Label>Description</Label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Optional. Add context, acceptance criteria, links."
              disabled={isSaving}
              size="sm"
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

            <div className="col-span-2 space-y-2">
              <Label>Assignees</Label>
              <AssigneesPicker
                members={members}
                selectedIds={assigneeIds}
                onChange={setAssigneeIds}
                disabled={isSaving}
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label>Attachments</Label>
              <AttachmentBuffer
                files={pendingFiles}
                links={pendingLinks}
                onFilesChange={setPendingFiles}
                onLinksChange={setPendingLinks}
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

// =========================================================
// Assignees picker (self-contained — the drawer's shared
// AssigneePicker expects a full TaskDetail we don't have yet).
// =========================================================

interface AssigneesPickerProps {
  members: TeamMember[]
  selectedIds: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
}

function AssigneesPicker({
  members,
  selectedIds,
  onChange,
  disabled,
}: AssigneesPickerProps) {
  const [query, setQuery] = useState('')
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectedMembers = useMemo(
    () => members.filter((m) => selectedSet.has(m.id)),
    [members, selectedSet],
  )
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
      selectedSet.has(id)
        ? selectedIds.filter((v) => v !== id)
        : [...selectedIds, id],
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
              'flex h-9 w-full items-center gap-2 rounded-md border bg-background px-3 text-left text-sm shadow-xs transition-colors',
              'hover:bg-accent hover:text-accent-foreground disabled:opacity-50',
            )}
          />
        }
      >
        {selectedMembers.length === 0 ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Users className="size-3.5" aria-hidden />
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
              max={4}
            />
            <span className="truncate text-muted-foreground">
              {selectedMembers.length === 1
                ? (selectedMembers[0]!.name ??
                    selectedMembers[0]!.email.split('@')[0])
                : `${selectedMembers.length} assigned`}
            </span>
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 p-0">
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
        <div className="max-h-64 overflow-auto p-1">
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
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {m.email.split('@')[0]}
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

// =========================================================
// Attachment buffer — local File[] + link[] until we have a
// task_id to associate them with. Rendered above the DialogFooter
// so operators can review what they'll attach before hitting Save.
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

  const hasAny = files.length > 0 || links.length > 0

  return (
    <div className="space-y-2">
      {hasAny ? (
        <ul className="space-y-1.5 rounded-md border bg-muted/20 p-2">
          {files.map((f, i) => (
            <li
              key={`f-${i}-${f.name}`}
              className="flex items-center gap-2 text-sm"
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
              className="flex items-center gap-2 text-sm"
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

      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="flex-1 justify-start text-muted-foreground"
        >
          <Upload className="size-3.5" />
          Upload (max {MAX_ATTACHMENT_MB} MB)
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setLinkFormOpen((v) => !v)}
          disabled={disabled}
          className="flex-1 justify-start text-muted-foreground"
        >
          <Link2 className="size-3.5" />
          Add link
        </Button>
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
    // Basic client-side validation — server re-checks protocol.
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
    <div className="space-y-2 rounded-md border bg-muted/20 p-2">
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

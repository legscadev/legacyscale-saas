'use client'

// Attachments panel for the task detail drawer. Ships upload +
// list + download + delete. Bytes travel through server actions
// (multipart FormData); downloads use short-lived signed URLs the
// browser opens directly.
//
// Optimistic policy mirrors the comment / checklist panels: local
// state updates as soon as the mutation returns ok; on error we
// roll back + toast. onChanged bubbles a drawer refetch so the
// activity timeline picks up attachment_added / attachment_removed.

import { formatDistanceToNow } from 'date-fns'
import {
  Download,
  ExternalLink,
  Link2,
  Loader2,
  Paperclip,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import {
  deleteTaskAttachmentAction,
  registerTaskLinkAttachmentAction,
  signTaskAttachmentUrlAction,
  uploadTaskAttachmentAction,
} from '@/app/(admin)/admin/tasks/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { TaskAttachmentRow } from '@/lib/services/task-attachment-service'

const MAX_MB = 10

interface TaskAttachmentsPanelProps {
  taskId: string
  attachments: TaskAttachmentRow[]
  onChanged?: () => void
}

export function TaskAttachmentsPanel({
  taskId,
  attachments,
  onChanged,
}: TaskAttachmentsPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, startUpload] = useTransition()
  const [linkFormOpen, setLinkFormOpen] = useState(false)

  function pick() {
    inputRef.current?.click()
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    // Upload files sequentially — the small drawer surface + single
    // Vercel body cap makes parallel uploads less valuable than
    // predictable ordering + per-file error toasts.
    startUpload(async () => {
      for (const file of Array.from(files)) {
        if (file.size > MAX_MB * 1024 * 1024) {
          toast.error(
            `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB — max ${MAX_MB} MB.`,
          )
          continue
        }
        const fd = new FormData()
        fd.set('taskId', taskId)
        fd.set('file', file)
        const res = await uploadTaskAttachmentAction(fd)
        if (!res.ok) {
          toast.error(
            `Could not upload "${file.name}": ${res.error ?? 'unknown error'}`,
          )
          continue
        }
        toast.success(`Uploaded "${file.name}"`)
      }
      onChanged?.()
    })
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-2">
      {attachments.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
          No attachments yet.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {attachments.map((att) => (
            <AttachmentRow
              key={att.id}
              attachment={att}
              onDeleted={() => onChanged?.()}
            />
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={pick}
          disabled={isUploading}
          className="flex-1 justify-start text-muted-foreground"
        >
          {isUploading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          {isUploading ? 'Uploading…' : `Upload (max ${MAX_MB} MB)`}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLinkFormOpen((v) => !v)}
          className="flex-1 justify-start text-muted-foreground"
        >
          <Link2 className="size-3.5" />
          Add link
        </Button>
      </div>

      {linkFormOpen ? (
        <AddLinkForm
          taskId={taskId}
          onCancel={() => setLinkFormOpen(false)}
          onAdded={() => {
            setLinkFormOpen(false)
            onChanged?.()
          }}
        />
      ) : null}
    </div>
  )
}

// =========================================================
// Add-link inline form
// =========================================================

function AddLinkForm({
  taskId,
  onCancel,
  onAdded,
}: {
  taskId: string
  onCancel: () => void
  onAdded: () => void
}) {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [isSaving, startSave] = useTransition()

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmedUrl = url.trim()
    if (!trimmedUrl) return
    startSave(async () => {
      const res = await registerTaskLinkAttachmentAction({
        taskId,
        name: name.trim(),
        url: trimmedUrl,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not add link')
        return
      }
      toast.success('Link added')
      onAdded()
    })
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-2 rounded-md border bg-muted/20 p-2"
    >
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://drive.google.com/… or https://figma.com/…"
        type="url"
        disabled={isSaving}
        autoFocus
        className="h-8 text-sm"
      />
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Display name (optional — defaults to the URL host)"
        disabled={isSaving}
        className="h-8 text-sm"
      />
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancel}
          disabled={isSaving}
        >
          <X className="size-3.5" />
          Cancel
        </Button>
        <Button size="sm" type="submit" disabled={isSaving || !url.trim()}>
          {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Save link
        </Button>
      </div>
    </form>
  )
}

// =========================================================
// Single attachment row
// =========================================================

interface AttachmentRowProps {
  attachment: TaskAttachmentRow
  onDeleted: () => void
}

function AttachmentRow({ attachment, onDeleted }: AttachmentRowProps) {
  const [isBusy, startBusy] = useTransition()

  function download() {
    startBusy(async () => {
      const res = await signTaskAttachmentUrlAction(attachment.id)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not open file')
        return
      }
      // window.open respects Content-Disposition: attachment on the
      // signed URL so the browser saves rather than navigates.
      window.open(res.data.url, '_blank', 'noopener,noreferrer')
    })
  }

  function remove() {
    if (!confirm(`Delete "${attachment.name}"?`)) return
    startBusy(async () => {
      const res = await deleteTaskAttachmentAction(attachment.id)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not delete attachment')
        return
      }
      onDeleted()
    })
  }

  const uploaderName = attachment.uploadedBy?.name ?? 'someone'
  const isLink = attachment.sourceUrl !== null
  const Icon = isLink ? Link2 : Paperclip
  const OpenIcon = isLink ? ExternalLink : Download
  const openLabel = isLink ? 'Open link' : 'Download'
  // Sub-line: uploaded rows show size, links show the URL host so
  // operators can tell Frame.io from Drive at a glance.
  const subLine = isLink
    ? safeHost(attachment.sourceUrl ?? '')
    : formatBytes(attachment.size)

  return (
    <li className="group/att flex items-center gap-2 rounded-md border p-2">
      <div className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {attachment.name}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {subLine} · {uploaderName} ·{' '}
          {formatDistanceToNow(attachment.createdAt, { addSuffix: true })}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={download}
          disabled={isBusy}
          aria-label={`${openLabel} ${attachment.name}`}
        >
          <OpenIcon className="size-3.5" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={remove}
          disabled={isBusy}
          aria-label={`Delete ${attachment.name}`}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </li>
  )
}

/** Best-effort URL → host extraction; falls back to the raw string
 *  if the URL doesn't parse (already validated server-side, but
 *  cheap safety net for stale local state). */
function safeHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

// =========================================================
// Helpers
// =========================================================

/** Small human-friendly byte formatter — kilobytes for anything
 *  under a MB, megabytes above. Kept local because the drawer is
 *  the only surface that cares. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

'use client'

// Attachments panel for the policy editor. Ships upload + list +
// download + delete + link. Mirrors task-attachments-panel — any
// change here is a candidate for that surface (and vice versa).
//
// Bytes travel through server actions (multipart FormData);
// downloads use short-lived signed URLs the browser opens
// directly. onChanged bubbles a page refetch so the activity log
// and detail view pick up attachment_added / attachment_removed.

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
  addPolicyLinkAttachmentAction,
  deletePolicyAttachmentAction,
  signPolicyAttachmentUrlAction,
  uploadPolicyAttachmentAction,
} from '@/app/(admin)/admin/policies/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { PolicyAttachmentRow } from '@/lib/services/policy-attachment-service'

const MAX_MB = 10

interface PolicyAttachmentsPanelProps {
  policyId: string
  attachments: PolicyAttachmentRow[]
  onChanged?: () => void
}

export function PolicyAttachmentsPanel({
  policyId,
  attachments,
  onChanged,
}: PolicyAttachmentsPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, startUpload] = useTransition()
  const [linkFormOpen, setLinkFormOpen] = useState(false)

  function pick() {
    inputRef.current?.click()
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    startUpload(async () => {
      for (const file of Array.from(files)) {
        if (file.size > MAX_MB * 1024 * 1024) {
          toast.error(
            `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB — max ${MAX_MB} MB.`,
          )
          continue
        }
        const fd = new FormData()
        fd.set('policyId', policyId)
        fd.set('file', file)
        const res = await uploadPolicyAttachmentAction(fd)
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
          policyId={policyId}
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

function AddLinkForm({
  policyId,
  onCancel,
  onAdded,
}: {
  policyId: string
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
      const res = await addPolicyLinkAttachmentAction({
        policyId,
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
        placeholder="Display name (optional — defaults to URL host)"
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

interface AttachmentRowProps {
  attachment: PolicyAttachmentRow
  onDeleted: () => void
}

function AttachmentRow({ attachment, onDeleted }: AttachmentRowProps) {
  const [isBusy, startBusy] = useTransition()

  function download() {
    startBusy(async () => {
      const res = await signPolicyAttachmentUrlAction(attachment.id)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not open file')
        return
      }
      window.open(res.data.url, '_blank', 'noopener,noreferrer')
    })
  }

  function remove() {
    if (!confirm(`Delete "${attachment.name}"?`)) return
    startBusy(async () => {
      const res = await deletePolicyAttachmentAction(attachment.id)
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

function safeHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

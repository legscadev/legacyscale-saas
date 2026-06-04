'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import MuxPlayer from '@mux/mux-player-react'
import * as UpChunk from '@mux/upchunk'
import {
  AlertTriangle,
  Download,
  FileText,
  Loader2,
  RotateCcw,
  Upload,
  Video,
  X,
} from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { createClient as createBrowserSupabase } from '@/lib/supabase/client'
import {
  commitResourceUploadAction,
  getResourceDownloadUrlAction,
  prepareResourceUploadAction,
  removeLessonResourceAction,
} from '@/app/(admin)/admin/courses/[id]/actions'
import type {
  LessonListItem,
  LessonResourceItem,
} from '@/lib/services/chapter-service'

interface LessonEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lesson: LessonListItem | null
  courseId: string
  /** Set when the row exists locally but hasn't been saved yet. */
  isUnsaved: boolean
  /** Pushes title/description changes back to the builder's local state. */
  onChange: (changes: { title?: string; description?: string | null }) => void
  /** Appends a newly-uploaded resource into the builder's local state. */
  onResourceAdded: (resource: LessonResourceItem) => void
  /** Removes a resource (post-server delete) from the builder's local state. */
  onResourceRemoved: (resourceId: string) => void
  /** Optimistically flip the video lesson to PROCESSING on upchunk success — the
   *  builder's polling effect will then tick until Mux flips it to READY. */
  onVideoUploadStarted: () => void
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function LessonEditorDialog({
  open,
  onOpenChange,
  lesson,
  courseId,
  isUnsaved,
  onChange,
  onResourceAdded,
  onResourceRemoved,
  onVideoUploadStarted,
}: LessonEditorDialogProps) {
  if (!lesson) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit lesson</DialogTitle>
          <DialogDescription>
            Changes to title and description save when you click Save in the
            course header. Uploads happen immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lesson-title">Title</Label>
            <Input
              id="lesson-title"
              value={lesson.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="Lesson title"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lesson-description">Description</Label>
            <Textarea
              id="lesson-description"
              value={lesson.description ?? ''}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Optional — what does this lesson cover?"
              className="min-h-20"
            />
          </div>

          {lesson.type === 'VIDEO' ? (
            <VideoSection
              lesson={lesson}
              isUnsaved={isUnsaved}
              onUploadStarted={onVideoUploadStarted}
            />
          ) : null}
          {lesson.type === 'RESOURCE' ? (
            <ResourceSection
              lesson={lesson}
              courseId={courseId}
              isUnsaved={isUnsaved}
              onResourceAdded={onResourceAdded}
              onResourceRemoved={onResourceRemoved}
            />
          ) : null}
        </div>

        <DialogFooter showCloseButton>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =====================================================================
// VIDEO SECTION — upload (2.10) + preview (2.10b)
// =====================================================================

interface VideoSectionProps {
  lesson: LessonListItem
  isUnsaved: boolean
  onUploadStarted: () => void
}

function VideoSection({ lesson, isUnsaved, onUploadStarted }: VideoSectionProps) {
  const [percent, setPercent] = useState<number | null>(null)
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'uploaded' | 'error'>(
    'idle',
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const uploaderRef = useRef<UpChunk.UpChunk | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Clean up any in-flight upload if the dialog unmounts or the
  // lesson swaps under us.
  useEffect(() => {
    return () => {
      uploaderRef.current?.abort()
      uploaderRef.current = null
    }
  }, [lesson.id])

  const startUpload = useCallback(
    async (file: File) => {
      if (!file) return
      setPhase('uploading')
      setPercent(0)
      setErrorMessage(null)

      try {
        const res = await fetch('/api/uploads/video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lessonId: lesson.id }),
        })
        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message ?? 'Could not create upload URL')
        }
        const uploadUrl = json.data.uploadUrl as string

        const uploader = UpChunk.createUpload({
          endpoint: uploadUrl,
          file,
          chunkSize: 30720, // 30 MB
        })
        uploaderRef.current = uploader

        uploader.on('error', (err) => {
          console.error('Mux upload error:', err)
          setPhase('error')
          setErrorMessage(
            (err.detail as Error | undefined)?.message ?? 'Upload failed',
          )
          uploaderRef.current = null
        })
        uploader.on('progress', (event) => {
          setPercent(Math.round(event.detail as number))
        })
        uploader.on('success', () => {
          setPhase('uploaded')
          setPercent(100)
          uploaderRef.current = null
          // Optimistically tell the builder the lesson is now
          // PROCESSING so its polling effect kicks in and the
          // status badge / dialog auto-update when Mux finishes.
          onUploadStarted()
          toast.success('Upload complete', {
            description:
              'Video is processing on Mux — usually takes a minute.',
          })
        })
      } catch (err) {
        console.error(err)
        setPhase('error')
        setErrorMessage(
          err instanceof Error ? err.message : 'Could not start upload',
        )
      }
    },
    [lesson.id, onUploadStarted],
  )

  const cancelUpload = useCallback(() => {
    uploaderRef.current?.abort()
    uploaderRef.current = null
    setPhase('idle')
    setPercent(null)
  }, [])

  const hasReadyAsset = lesson.status === 'READY' && lesson.muxPlaybackId
  const isProcessing = lesson.status === 'PROCESSING'

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Video className="size-3.5" />
        Video
      </div>

      {isUnsaved ? (
        <Warning
          icon={AlertTriangle}
          text="Save your course changes first — uploads need a saved lesson id."
        />
      ) : phase === 'uploading' ? (
        <UploadProgress percent={percent ?? 0} onCancel={cancelUpload} />
      ) : phase === 'uploaded' ? (
        <Warning
          icon={Loader2}
          iconClassName="animate-spin"
          text="Upload finished. Mux is encoding — close this dialog and refresh in a minute to preview."
        />
      ) : hasReadyAsset ? (
        <ReadyState
          playbackId={lesson.muxPlaybackId!}
          title={lesson.title}
          durationSeconds={lesson.durationSeconds}
          onReplace={() => fileInputRef.current?.click()}
        />
      ) : isProcessing ? (
        <Warning
          icon={Loader2}
          iconClassName="animate-spin"
          text="Video is processing on Mux. Close this dialog and refresh in a minute."
        />
      ) : (
        <EmptyState onPick={() => fileInputRef.current?.click()} />
      )}

      {phase === 'error' && errorMessage ? (
        <p className="text-xs text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void startUpload(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function EmptyState({ onPick }: { onPick: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center">
      <p className="text-sm text-muted-foreground">
        No video uploaded yet.
      </p>
      <Button type="button" size="sm" onClick={onPick}>
        <Upload />
        Upload video
      </Button>
    </div>
  )
}

function UploadProgress({
  percent,
  onCancel,
}: {
  percent: number
  onCancel: () => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Uploading… {percent}%</span>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
        >
          <X className="size-3" />
          Cancel
        </button>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-[width] duration-200"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

function ReadyState({
  playbackId,
  title,
  durationSeconds,
  onReplace,
}: {
  playbackId: string
  title: string
  durationSeconds: number | null
  onReplace: () => void
}) {
  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-md bg-black">
        <MuxPlayer
          playbackId={playbackId}
          streamType="on-demand"
          metadata={{ video_title: title }}
          style={{ aspectRatio: '16 / 9', width: '100%' }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Duration: {formatDuration(durationSeconds)}</span>
        <button
          type="button"
          onClick={onReplace}
          className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
        >
          <RotateCcw className="size-3" />
          Replace video
        </button>
      </div>
    </div>
  )
}

function Warning({
  icon: Icon,
  iconClassName,
  text,
}: {
  icon: typeof AlertTriangle
  iconClassName?: string
  text: string
}) {
  return (
    <div className="flex items-start gap-2 rounded-md bg-warning/10 p-2 text-xs text-warning">
      <Icon className={cn('mt-0.5 size-3.5 shrink-0', iconClassName)} />
      <span>{text}</span>
    </div>
  )
}

// =====================================================================
// RESOURCE SECTION — file upload list (2.13 → multi-resource)
// =====================================================================

const RESOURCE_MAX_BYTES = 50 * 1024 * 1024 // mirrors server cap
const RESOURCE_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.json,.txt,.csv,.md,.png,.jpg,.jpeg,.webp'

interface ResourceSectionProps {
  lesson: LessonListItem
  courseId: string
  isUnsaved: boolean
  onResourceAdded: (resource: LessonResourceItem) => void
  onResourceRemoved: (resourceId: string) => void
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ResourceSection({
  lesson,
  courseId,
  isUnsaved,
  onResourceAdded,
  onResourceRemoved,
}: ResourceSectionProps) {
  const [uploading, setUploading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resources = lesson.resources

  const startUpload = useCallback(
    async (file: File) => {
      if (!file) return
      if (file.size > RESOURCE_MAX_BYTES) {
        setErrorMessage('File must be 50 MB or smaller')
        return
      }
      setUploading(true)
      setErrorMessage(null)

      try {
        const prep = await prepareResourceUploadAction({
          lessonId: lesson.id,
          filename: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
        })
        if (
          !prep.ok ||
          !prep.signedUrl ||
          !prep.token ||
          !prep.path ||
          !prep.resourceId
        ) {
          throw new Error(prep.error ?? 'Could not start upload')
        }

        const supabase = createBrowserSupabase()
        const { error: uploadErr } = await supabase.storage
          .from('lesson-resources')
          .uploadToSignedUrl(prep.path, prep.token, file, {
            contentType: file.type || 'application/octet-stream',
          })
        if (uploadErr) throw uploadErr

        const commit = await commitResourceUploadAction(courseId, {
          lessonId: lesson.id,
          resourceId: prep.resourceId,
          path: prep.path,
          filename: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
        })
        if (!commit.ok || !commit.resource) {
          throw new Error(commit.error ?? 'Could not save resource')
        }

        onResourceAdded(commit.resource)
        toast.success(`${file.name} uploaded`)
      } catch (err) {
        console.error(err)
        setErrorMessage(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setUploading(false)
      }
    },
    [courseId, lesson.id, onResourceAdded],
  )

  const onDownload = useCallback(async (resourceId: string) => {
    const result = await getResourceDownloadUrlAction(resourceId)
    if (!result.ok || !result.url) {
      toast.error(result.error ?? 'Could not generate download link')
      return
    }
    window.open(result.url, '_blank', 'noopener,noreferrer')
  }, [])

  const onRemove = useCallback(
    async (resourceId: string) => {
      const result = await removeLessonResourceAction(courseId, resourceId)
      if (!result.ok) {
        toast.error(result.error ?? 'Could not delete resource')
        return
      }
      onResourceRemoved(resourceId)
      toast.success('Resource removed')
    },
    [courseId, onResourceRemoved],
  )

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <FileText className="size-3.5" />
        Resources
        {resources.length > 0 ? (
          <span className="text-muted-foreground/60">· {resources.length}</span>
        ) : null}
      </div>

      {isUnsaved ? (
        <Warning
          icon={AlertTriangle}
          text="Save your course changes first — uploads need a saved lesson id."
        />
      ) : (
        <>
          {resources.length === 0 ? (
            <p className="py-2 text-center text-sm text-muted-foreground">
              No files attached yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {resources.map((r) => (
                <li key={r.id}>
                  <FileRow
                    name={r.name}
                    size={r.size}
                    onDownload={() => void onDownload(r.id)}
                    onRemove={() => void onRemove(r.id)}
                  />
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col items-center gap-1.5 pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full border-dashed"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
              {uploading ? 'Uploading…' : 'Add resource'}
            </Button>
            <p className="text-xs text-muted-foreground/70">
              PDF, Word, Excel, PowerPoint, image, zip, or text. 50 MB max.
            </p>
          </div>
        </>
      )}

      {errorMessage ? (
        <p className="text-xs text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept={RESOURCE_ACCEPT}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void startUpload(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function FileRow({
  name,
  size,
  onDownload,
  onRemove,
}: {
  name: string
  size: number | null
  onDownload: () => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-background p-2.5">
      <FileText className="size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{formatFileSize(size)}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Download file"
        onClick={onDownload}
      >
        <Download />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Remove file"
        onClick={onRemove}
      >
        <X />
      </Button>
    </div>
  )
}

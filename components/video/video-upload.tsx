'use client'

import { useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

type UploadStatus =
  | 'idle'
  | 'preparing'
  | 'uploading'
  | 'processing'
  | 'complete'
  | 'error'

interface VideoUploadProps {
  lessonId: string
  onUploadComplete?: () => void
  className?: string
}

const MAX_BYTES = 5 * 1024 * 1024 * 1024 // 5 GB

export function VideoUpload({
  lessonId,
  onUploadComplete,
  className,
}: VideoUploadProps) {
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStatus('idle')
    setProgress(0)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('video/')) {
      setError('Please select a video file')
      setStatus('error')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('File size must be less than 5GB')
      setStatus('error')
      return
    }

    setError(null)
    setStatus('preparing')

    try {
      const response = await fetch('/api/uploads/video', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lessonId }),
      })

      if (!response.ok) {
        throw new Error('Failed to create upload')
      }

      const json = (await response.json()) as {
        success: true
        data: { uploadId: string; uploadUrl: string }
      }
      const { uploadUrl } = json.data

      setStatus('uploading')
      await putToMux(file, uploadUrl, setProgress)

      // The webhook flips the lesson to PROCESSING/READY once Mux finishes
      // encoding. Locally that pings our /api/webhooks/mux endpoint.
      setStatus('processing')
      setProgress(100)
      onUploadComplete?.()
      setStatus('complete')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setStatus('error')
    }
  }

  return (
    <div className={cn('space-y-4', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={status !== 'idle' && status !== 'error'}
      />

      {(status === 'idle' || status === 'error') && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors hover:border-primary/50"
        >
          <Upload className="mb-4 size-10 text-muted-foreground" />
          <p className="text-sm font-medium">Click to upload video</p>
          <p className="mt-1 text-xs text-muted-foreground">
            MP4, MOV, or WebM up to 5GB
          </p>
        </button>
      )}

      {(status === 'preparing' || status === 'uploading') && (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="size-5 animate-spin text-primary" />
            <span className="text-sm font-medium">
              {status === 'preparing'
                ? 'Preparing upload…'
                : `Uploading… ${progress}%`}
            </span>
          </div>
          <Progress value={progress} />
        </div>
      )}

      {status === 'processing' && (
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="size-5 animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium">Processing video…</p>
              <p className="text-xs text-muted-foreground">
                This may take a few minutes
              </p>
            </div>
          </div>
        </div>
      )}

      {status === 'complete' && (
        <div className="flex items-center justify-between rounded-lg border border-success/30 bg-success/10 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-5 text-success" />
            <span className="text-sm font-medium text-success">
              Upload complete!
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={reset}>
            Upload another
          </Button>
        </div>
      )}

      {status === 'error' && error && (
        <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="size-5 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">
                Upload failed
              </p>
              <p className="text-xs text-destructive/80">{error}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={reset}>
            <X className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

function putToMux(
  file: File,
  url: string,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    })
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Upload failed (HTTP ${xhr.status})`))
    })
    xhr.addEventListener('error', () => reject(new Error('Network error')))
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')))
    xhr.open('PUT', url)
    xhr.send(file)
  })
}

'use client'

import { useTransition } from 'react'
import { Download, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getResourceDownloadUrlAction } from '@/app/(user)/courses/[courseId]/lessons/[lessonId]/actions'

interface Resource {
  id: string
  name: string
  size: number
  mimeType: string
}

interface ResourceViewProps {
  title: string
  description: string | null
  resources: Resource[]
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function ResourceView({
  title,
  description,
  resources,
}: ResourceViewProps) {
  return (
    <Card className="gap-5 p-6">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {resources.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No attachments uploaded yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {resources.map((r) => (
            <li key={r.id}>
              <ResourceRow resource={r} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function ResourceRow({ resource }: { resource: Resource }) {
  const [isPending, startTransition] = useTransition()

  const handleDownload = () => {
    startTransition(async () => {
      const res = await getResourceDownloadUrlAction(resource.id)
      if (!res.ok || !res.url) {
        toast.error(res.error ?? 'Could not start download')
        return
      }
      // Navigate to the signed URL; Supabase serves it with the
      // Content-Disposition header from the `download` option so
      // the browser saves the file directly.
      window.location.href = res.url
    })
  }

  return (
    <div className="flex items-center gap-4 rounded-xl border p-4">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-error/10 text-error">
        <FileText className="size-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{resource.name}</p>
        <p className="text-xs text-muted-foreground">
          {resource.mimeType} · {formatFileSize(resource.size)}
        </p>
      </div>
      <Button onClick={handleDownload} disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="animate-spin" />
            Preparing…
          </>
        ) : (
          <>
            <Download />
            Download
          </>
        )}
      </Button>
    </div>
  )
}

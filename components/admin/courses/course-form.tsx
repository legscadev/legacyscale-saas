'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Image as ImageIcon, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { CourseStatus } from '@prisma/client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const CREATE_STATUSES: { value: CourseStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
]

const EDIT_STATUSES: { value: CourseStatus; label: string }[] = [
  ...CREATE_STATUSES,
  { value: 'ARCHIVED', label: 'Archived' },
]

export interface CourseFormSubmitResult {
  ok: boolean
  id?: string
  error?: string
  fieldErrors?: Record<string, string[]>
}

export interface CourseFormDefaults {
  title?: string
  description?: string | null
  thumbnailUrl?: string | null
  status?: CourseStatus
  accessDays?: number | null
}

interface CourseFormProps {
  mode: 'create' | 'edit'
  defaults?: CourseFormDefaults
  submitLabel: string
  /** Server action that takes FormData. */
  onSubmit: (formData: FormData) => Promise<CourseFormSubmitResult>
  /** Optional destructive action — only used by edit (soft delete). */
  destructiveAction?: React.ReactNode
}

function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-0.5 text-destructive">
      *
    </span>
  )
}

type FieldErrors = Partial<Record<string, string[]>>

export function CourseForm({
  mode,
  defaults,
  submitLabel,
  onSubmit,
  destructiveAction,
}: CourseFormProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState(defaults?.title ?? '')
  const [description, setDescription] = useState(defaults?.description ?? '')
  const [status, setStatus] = useState<CourseStatus>(
    defaults?.status ?? 'DRAFT',
  )
  const [forever, setForever] = useState(
    defaults?.accessDays === undefined ? true : defaults.accessDays === null,
  )
  const [accessDays, setAccessDays] = useState<string>(
    defaults?.accessDays && defaults.accessDays > 0
      ? String(defaults.accessDays)
      : '30',
  )

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  // Track whether the user explicitly cleared the existing thumbnail.
  const hadExistingThumbnail = !!defaults?.thumbnailUrl
  const [clearedThumbnail, setClearedThumbnail] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)

  // Object URL for the picked file; recomputed when the file changes.
  // Falls back to the existing remote URL when no file is picked yet.
  const pickedPreview = useMemo(() => {
    if (!thumbnailFile) return null
    return URL.createObjectURL(thumbnailFile)
  }, [thumbnailFile])
  // Revoke when the picked URL goes out of scope to avoid leaks.
  useEffect(() => {
    if (!pickedPreview) return
    return () => URL.revokeObjectURL(pickedPreview)
  }, [pickedPreview])
  const thumbnailPreview =
    pickedPreview ??
    (clearedThumbnail ? null : (defaults?.thumbnailUrl ?? null))

  const statusOptions = mode === 'edit' ? EDIT_STATUSES : CREATE_STATUSES

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setThumbnailFile(file)
    setClearedThumbnail(false)
    if (fieldErrors.thumbnail) {
      setFieldErrors((prev) => ({ ...prev, thumbnail: undefined }))
    }
  }

  function clearThumbnail() {
    setThumbnailFile(null)
    setClearedThumbnail(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError(null)
    setFieldErrors({})

    const trimmedTitle = title.trim()
    const localErrors: FieldErrors = {}

    if (!trimmedTitle) {
      localErrors.title = ['Title is required']
    } else if (trimmedTitle.length > 200) {
      localErrors.title = ['Title is too long']
    }

    if (!forever) {
      const n = Number(accessDays)
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
        localErrors.accessDays = ['Enter a number of days, or pick Forever']
      } else if (n > 36500) {
        localErrors.accessDays = ['Access days is too large']
      }
    }

    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors)
      return
    }

    const formData = new FormData()
    formData.set('title', trimmedTitle)
    if (description.trim()) formData.set('description', description.trim())
    formData.set('status', status)
    if (!forever) formData.set('accessDays', accessDays)
    if (thumbnailFile) formData.set('thumbnail', thumbnailFile)
    if (clearedThumbnail && !thumbnailFile) {
      formData.set('clearThumbnail', '1')
    }

    setSubmitting(true)
    try {
      const result = await onSubmit(formData)
      if (!result.ok) {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors)
        if (result.error) setFormError(result.error)
        return
      }
      if (result.error) {
        // Partial success — e.g. row created but thumbnail upload failed.
        toast.warning(result.error)
      } else {
        toast.success(mode === 'create' ? 'Course created' : 'Course updated')
      }
      if (mode === 'create') {
        // Phase C will host /admin/courses/[id] (course detail). For now
        // land on the list, which already shows the new row.
        router.push('/admin/courses')
      } else {
        router.refresh()
      }
    } catch (err) {
      console.error(err)
      setFormError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div className="space-y-2">
        <Label htmlFor="course-title">
          Title
          <RequiredMark />
        </Label>
        <Input
          id="course-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. The 7-Figure Agency Program"
          disabled={submitting}
          aria-invalid={!!fieldErrors.title}
          aria-required="true"
          autoFocus
        />
        {fieldErrors.title?.[0] && (
          <p className="text-xs text-destructive" role="alert">
            {fieldErrors.title[0]}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="course-description">Description</Label>
        <RichTextEditor
          id="course-description"
          value={description}
          onChange={setDescription}
          placeholder="A short summary of what members will learn."
          disabled={submitting}
        />
        {fieldErrors.description?.[0] && (
          <p className="text-xs text-destructive" role="alert">
            {fieldErrors.description[0]}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Thumbnail</Label>
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'grid aspect-video w-48 shrink-0 place-items-center overflow-hidden rounded-md border border-dashed bg-muted',
              fieldErrors.thumbnail && 'border-destructive',
            )}
          >
            {thumbnailPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnailPreview}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <ImageIcon className="size-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <input
              ref={fileInputRef}
              id="course-thumbnail"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFilePick}
              disabled={submitting}
              className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted/80"
            />
            <p className="text-xs text-muted-foreground">
              PNG, JPEG, or WebP. 5 MB max. 16:9 aspect rendered best.
            </p>
            {(thumbnailFile || (hadExistingThumbnail && !clearedThumbnail)) && (
              <button
                type="button"
                onClick={clearThumbnail}
                className="self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                disabled={submitting}
              >
                Remove
              </button>
            )}
            {fieldErrors.thumbnail?.[0] && (
              <p className="text-xs text-destructive" role="alert">
                {fieldErrors.thumbnail[0]}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="course-status">Status</Label>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as CourseStatus)}
          >
            <SelectTrigger className="w-full" id="course-status">
              <SelectValue>
                {(v: string) =>
                  statusOptions.find((s) => s.value === v)?.label ?? 'Draft'
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Drafts are admin-only. Published courses appear in the member
            catalogue.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="course-access-days">Access duration</Label>
          <div className="flex items-center gap-2">
            <Input
              id="course-access-days"
              type="number"
              min={1}
              max={36500}
              value={forever ? '' : accessDays}
              onChange={(e) => setAccessDays(e.target.value)}
              placeholder="Days"
              disabled={forever || submitting}
              aria-invalid={!!fieldErrors.accessDays}
              className="w-28"
            />
            <span className="text-sm text-muted-foreground">days</span>
            <label className="ml-2 flex items-center gap-2 text-sm">
              <Checkbox
                checked={forever}
                onCheckedChange={(c) => setForever(Boolean(c))}
                disabled={submitting}
              />
              Forever
            </label>
          </div>
          {fieldErrors.accessDays?.[0] && (
            <p className="text-xs text-destructive" role="alert">
              {fieldErrors.accessDays[0]}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            How long a member retains access after enrollment.
          </p>
        </div>
      </div>

      {formError && (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 border-t pt-4">
        <div>{destructiveAction}</div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              'Saving…'
            ) : (
              <>
                <Save />
                {submitLabel}
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  )
}

// Re-exported so destructive actions can use the same icon set.
export { Trash2 }

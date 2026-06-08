'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Image as ImageIcon, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { CourseAudience, CourseStatus } from '@prisma/client'

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
  coverImageUrl?: string | null
  status?: CourseStatus
  accessDays?: number | null
  isFree?: boolean
  audience?: CourseAudience
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
  const [isFree, setIsFree] = useState<boolean>(defaults?.isFree ?? false)
  const [audience, setAudience] = useState<CourseAudience>(
    defaults?.audience ?? 'MEMBERS',
  )

  const thumbnailPicker = useImagePicker({
    existingUrl: defaults?.thumbnailUrl,
  })
  const coverPicker = useImagePicker({
    existingUrl: defaults?.coverImageUrl,
  })

  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)

  const statusOptions = mode === 'edit' ? EDIT_STATUSES : CREATE_STATUSES

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

    const thumbnailLocalErr = thumbnailPicker.validate('Thumbnail')
    if (thumbnailLocalErr) localErrors.thumbnail = [thumbnailLocalErr]
    const coverLocalErr = coverPicker.validate('Cover image')
    if (coverLocalErr) localErrors.coverImage = [coverLocalErr]

    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors)
      return
    }

    const formData = new FormData()
    formData.set('title', trimmedTitle)
    if (description.trim()) formData.set('description', description.trim())
    formData.set('status', status)
    formData.set('isFree', isFree ? '1' : '0')
    formData.set('audience', audience)
    if (!forever) formData.set('accessDays', accessDays)
    thumbnailPicker.appendTo(formData, {
      fileKey: 'thumbnail',
      clearKey: 'clearThumbnail',
    })
    coverPicker.appendTo(formData, {
      fileKey: 'coverImage',
      clearKey: 'clearCoverImage',
    })

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
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      <FormSection title="Basics" description="What members will see first.">
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
      </FormSection>

      <FormSection
        title="Media"
        description="Square thumbnail for the course card, wide hero for the detail page."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <ImagePicker
            label="Thumbnail"
            inputId="course-thumbnail"
            picker={thumbnailPicker}
            aspectClass="aspect-[4/3]"
            helper="PNG, JPEG, or WebP. 10 MB max. 4:3 — used on the course card."
            disabled={submitting}
            error={fieldErrors.thumbnail?.[0]}
          />

          <ImagePicker
            label="Cover image"
            inputId="course-cover"
            picker={coverPicker}
            aspectClass="aspect-video"
            helper="PNG, JPEG, or WebP. 10 MB max. 16:9 — hero on the course detail page."
            disabled={submitting}
            error={fieldErrors.coverImage?.[0]}
          />
        </div>
      </FormSection>

      <FormSection
        title="Access & visibility"
        description="Who can see this course and on what terms."
      >
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

      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Audience</Label>
          <div className="grid gap-2 sm:grid-cols-3">
            <AudienceOption
              value="MEMBERS"
              current={audience}
              disabled={submitting}
              onSelect={setAudience}
              title="Members"
              body="Shown in the member catalog only."
            />
            <AudienceOption
              value="INTERNAL"
              current={audience}
              disabled={submitting}
              onSelect={setAudience}
              title="Internal team"
              body="Hidden from members. Admins only."
            />
            <AudienceOption
              value="BOTH"
              current={audience}
              disabled={submitting}
              onSelect={setAudience}
              title="Both"
              body="Shown to members and internal team."
            />
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-4">
          <label className="flex items-start gap-3">
            <Checkbox
              checked={isFree}
              onCheckedChange={(c) => setIsFree(Boolean(c))}
              disabled={submitting || audience === 'INTERNAL'}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Free for all members</p>
              <p className="text-xs text-muted-foreground">
                Any signed-in member can open this course without an enrollment.
                Leave off to keep it gated behind enrollment.
                {audience === 'INTERNAL' ? (
                  <span className="ml-1 italic">
                    Not applicable — internal courses are hidden from members.
                  </span>
                ) : null}
              </p>
            </div>
          </label>
        </div>
      </div>
      </FormSection>

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

// ===========================================================
// Form section — labeled group with a divider so the long form
// scans as three areas (Basics / Media / Access & visibility)
// instead of one flat list.
// ===========================================================

function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-4 border-t pt-6 first:border-t-0 first:pt-0 sm:grid-cols-[12rem_1fr]">
      <header className="space-y-1">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </header>
      <div className="space-y-6">{children}</div>
    </section>
  )
}

// ===========================================================
// Audience option — single tile in the three-way audience picker
// ===========================================================

interface AudienceOptionProps {
  value: CourseAudience
  current: CourseAudience
  disabled?: boolean
  onSelect: (next: CourseAudience) => void
  title: string
  body: string
}

function AudienceOption({
  value,
  current,
  disabled,
  onSelect,
  title,
  body,
}: AudienceOptionProps) {
  const active = current === value
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      disabled={disabled}
      className={cn(
        'flex w-full flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors',
        active
          ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
          : 'border-border bg-muted/30 hover:border-foreground/20 hover:bg-muted/50',
        disabled && 'cursor-not-allowed opacity-60',
      )}
      aria-pressed={active}
    >
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted-foreground">{body}</span>
    </button>
  )
}

// ===========================================================
// Image picker — shared by Thumbnail (4:3) and Cover (16:9)
// ===========================================================

// Matches the server-side cap. Validating client-side too means the
// user sees a useful "image too big" message instead of getting hit
// with "Network error" when the multipart body exceeds the Server
// Action / Vercel function body limit and the request dies before
// the action runs.
const IMAGE_MAX_BYTES = 10 * 1024 * 1024

interface ImagePickerState {
  file: File | null
  setFile: (f: File | null) => void
  cleared: boolean
  setCleared: (c: boolean) => void
  hadExisting: boolean
  preview: string | null
  inputRef: React.RefObject<HTMLInputElement | null>
  reset: () => void
  validate: (label: 'Thumbnail' | 'Cover image') => string | null
  appendTo: (
    formData: FormData,
    keys: { fileKey: string; clearKey: string },
  ) => void
}

function useImagePicker({
  existingUrl,
}: {
  existingUrl?: string | null
}): ImagePickerState {
  const [file, setFile] = useState<File | null>(null)
  const [cleared, setCleared] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Object URL for the picked file; recomputed when the file changes.
  // Falls back to the existing remote URL when no file is picked yet.
  const pickedPreview = useMemo(() => {
    if (!file) return null
    return URL.createObjectURL(file)
  }, [file])
  useEffect(() => {
    if (!pickedPreview) return
    return () => URL.revokeObjectURL(pickedPreview)
  }, [pickedPreview])
  const preview = pickedPreview ?? (cleared ? null : (existingUrl ?? null))

  return {
    file,
    setFile,
    cleared,
    setCleared,
    hadExisting: !!existingUrl,
    preview,
    inputRef,
    reset: () => {
      setFile(null)
      setCleared(true)
      if (inputRef.current) inputRef.current.value = ''
    },
    validate: (label) => {
      if (!file) return null
      if (file.size > IMAGE_MAX_BYTES) {
        const mb = (file.size / (1024 * 1024)).toFixed(1)
        return `${label} must be 10 MB or smaller (this one is ${mb} MB)`
      }
      return null
    },
    appendTo: (formData, { fileKey, clearKey }) => {
      if (file) formData.set(fileKey, file)
      if (cleared && !file) formData.set(clearKey, '1')
    },
  }
}

interface ImagePickerProps {
  label: string
  inputId: string
  picker: ImagePickerState
  aspectClass: string
  helper: string
  disabled?: boolean
  error?: string
}

function ImagePicker({
  label,
  inputId,
  picker,
  aspectClass,
  helper,
  disabled,
  error,
}: ImagePickerProps) {
  const stillShowing = !!picker.file || (picker.hadExisting && !picker.cleared)
  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="space-y-3">
        <div
          className={cn(
            'grid w-44 max-w-full place-items-center overflow-hidden rounded-md border border-dashed bg-muted',
            aspectClass,
            error && 'border-destructive',
          )}
        >
          {picker.preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={picker.preview}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <ImageIcon className="size-8 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={picker.inputRef}
            id={inputId}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const next = e.target.files?.[0] ?? null
              picker.setFile(next)
              picker.setCleared(false)
            }}
            disabled={disabled}
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted/80"
          />
          <p className="text-xs text-muted-foreground">{helper}</p>
          {stillShowing && (
            <button
              type="button"
              onClick={picker.reset}
              className="self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              disabled={disabled}
            >
              Remove
            </button>
          )}
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

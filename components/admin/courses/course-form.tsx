'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Award, Check, Image as ImageIcon, Save, Tag, Trash2, Upload } from 'lucide-react'
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
import { slugify } from '@/lib/utils/slug'
import { FormSection } from '@/components/shared'
import { createClient as createBrowserSupabase } from '@/lib/supabase/client'
import { prepareCourseImageUploadAction } from '@/app/(admin)/admin/courses/actions'

const IMAGE_BUCKET = 'course-thumbnails'

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

export interface CourseFormCategoryOption {
  id: string
  name: string
}

export interface CourseFormDefaults {
  title?: string
  slug?: string | null
  description?: string | null
  thumbnailUrl?: string | null
  coverImageUrl?: string | null
  certificateEnabled?: boolean
  status?: CourseStatus
  accessDays?: number | null
  isFree?: boolean
  audience?: CourseAudience
  categoryIds?: string[]
}

interface CourseFormProps {
  mode: 'create' | 'edit'
  defaults?: CourseFormDefaults
  submitLabel: string
  /** Full list of selectable categories. Empty array hides the section. */
  categories: CourseFormCategoryOption[]
  /** Existing course id for edit. Omitted on create — the form mints
   *  a UUID up front so the signed-upload flow has a stable folder
   *  before the row exists. */
  courseId?: string
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
  categories,
  courseId,
  onSubmit,
  destructiveAction,
}: CourseFormProps) {
  const router = useRouter()

  // Stable course id across re-renders. For edit, the parent passes it
  // in. For create, mint once on mount so the signed-upload prepare
  // call can address the correct (eventual) folder.
  const courseIdRef = useRef<string>(courseId ?? crypto.randomUUID())

  const [title, setTitle] = useState(defaults?.title ?? '')
  const [slug, setSlug] = useState(defaults?.slug ?? '')
  // Once the admin types into the slug field we stop auto-deriving
  // from the title — otherwise we'd clobber their intent on every
  // keystroke. Edit mode starts "manual" since there's a saved slug.
  const [slugTouched, setSlugTouched] = useState(mode === 'edit')
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
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(
    () => new Set(defaults?.categoryIds ?? []),
  )

  const derivedSlug = useMemo(() => slugify(title), [title])
  // Surfaced placeholder so admins know what the auto-slug will be
  // before they save.
  const slugForSubmit = slugTouched ? slug.trim() : derivedSlug

  const thumbnailPicker = useImagePicker({
    existingUrl: defaults?.thumbnailUrl,
  })
  const coverPicker = useImagePicker({
    existingUrl: defaults?.coverImageUrl,
  })
  const [certificateEnabled, setCertificateEnabled] = useState<boolean>(
    defaults?.certificateEnabled ?? false,
  )

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

    setSubmitting(true)
    try {
      // Upload images BEFORE the form submit so the action body stays
      // small. Routing 8 MB images through a Server Action would hit
      // Vercel's ~4.5 MB function-gateway body cap and the client would
      // just see a generic "Network error".
      const id = courseIdRef.current
      const thumbnailPath = await uploadImageIfPicked(
        thumbnailPicker,
        id,
        'thumbnail',
      )
      if (thumbnailPath.error) {
        setFieldErrors({ thumbnail: [thumbnailPath.error] })
        return
      }
      const coverPath = await uploadImageIfPicked(coverPicker, id, 'cover')
      if (coverPath.error) {
        setFieldErrors({ coverImage: [coverPath.error] })
        return
      }

      const formData = new FormData()
      formData.set('courseId', id)
      formData.set('title', trimmedTitle)
      // Empty slug on edit means "re-derive from title"; on create
      // the server falls back to title-derived too.
      formData.set('slug', slugForSubmit)
      if (description.trim()) formData.set('description', description.trim())
      formData.set('status', status)
      formData.set('isFree', isFree ? '1' : '0')
      formData.set('audience', audience)
      if (!forever) formData.set('accessDays', accessDays)
      if (thumbnailPath.path) formData.set('thumbnailPath', thumbnailPath.path)
      if (thumbnailPicker.cleared && !thumbnailPicker.file) {
        formData.set('clearThumbnail', '1')
      }
      if (coverPath.path) formData.set('coverImagePath', coverPath.path)
      if (coverPicker.cleared && !coverPicker.file) {
        formData.set('clearCoverImage', '1')
      }
      formData.set('certificateEnabled', certificateEnabled ? '1' : '0')
      // Always send the categories key — even empty — so the server
      // treats this as a full replace (clearing on edit when the
      // admin removes every chip).
      formData.append('categoryIds', '')
      for (const cid of selectedCategoryIds) {
        formData.append('categoryIds', cid)
      }

      const result = await onSubmit(formData)
      if (!result.ok) {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors)
        if (result.error) setFormError(result.error)
        return
      }
      toast.success(mode === 'create' ? 'Course created' : 'Course updated')
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

  // Upload one of the two image slots via signed URL. Returns the
  // storage path on success so the caller can post it to the Server
  // Action. No file → no path → no upload (a no-op).
  async function uploadImageIfPicked(
    picker: ImagePickerState,
    id: string,
    kind: 'thumbnail' | 'cover',
  ): Promise<{ path?: string; error?: string }> {
    const file = picker.file
    if (!file) return {}
    const prep = await prepareCourseImageUploadAction({
      courseId: id,
      kind,
      filename: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
    })
    if (!prep.ok || !prep.signedUrl || !prep.token || !prep.path) {
      return { error: prep.error ?? 'Could not start upload' }
    }
    const supabase = createBrowserSupabase()
    const { error: uploadErr } = await supabase.storage
      .from(IMAGE_BUCKET)
      .uploadToSignedUrl(prep.path, prep.token, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
      })
    if (uploadErr) return { error: uploadErr.message ?? 'Upload failed' }
    return { path: prep.path }
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
          <Label htmlFor="course-slug">URL slug</Label>
          <div className="flex items-center gap-1 rounded-md border bg-muted/40 focus-within:ring-2 focus-within:ring-ring/40">
            <span className="select-none pl-3 text-sm text-muted-foreground">
              /courses/
            </span>
            <Input
              id="course-slug"
              value={slugTouched ? slug : derivedSlug}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(e.target.value.toLowerCase())
              }}
              placeholder={derivedSlug || 'my-course'}
              disabled={submitting}
              aria-invalid={!!fieldErrors.slug}
              className="border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
            />
          </div>
          {fieldErrors.slug?.[0] ? (
            <p className="text-xs text-destructive" role="alert">
              {fieldErrors.slug[0]}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Used in the public course URL. Auto-derived from the title — edit
              for a tighter SEO target. Lowercase letters, numbers, and hyphens.
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
        title="Categories"
        description="Group this course alongside related programs. Members can browse by category."
      >
        <CategoryPicker
          categories={categories}
          selected={selectedCategoryIds}
          onToggle={(id) => {
            setSelectedCategoryIds((prev) => {
              const next = new Set(prev)
              if (next.has(id)) next.delete(id)
              else next.add(id)
              return next
            })
          }}
          disabled={submitting}
        />
        {fieldErrors.categoryIds?.[0] && (
          <p className="text-xs text-destructive" role="alert">
            {fieldErrors.categoryIds[0]}
          </p>
        )}
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
        title="Completion certificate"
        description="When enabled, members who complete this course can download a Kondense-branded PDF certificate (name, course title, completion date, length, and a verification ID)."
      >
        <label className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
          <Checkbox
            checked={certificateEnabled}
            onCheckedChange={(c) => setCertificateEnabled(Boolean(c))}
            disabled={submitting}
            className="mt-0.5"
          />
          <div className="space-y-0.5">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Award className="size-3.5 text-muted-foreground" />
              Award a certificate on completion
            </p>
            <p className="text-xs text-muted-foreground">
              Off by default. Turn on for graded courses where finishing
              earns a certificate worth sharing.
            </p>
          </div>
        </label>
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
          <Button type="submit" loading={submitting}>
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
// Category picker — chip-style toggle list
// ===========================================================

interface CategoryPickerProps {
  categories: CourseFormCategoryOption[]
  selected: Set<string>
  onToggle: (id: string) => void
  disabled?: boolean
}

function CategoryPicker({
  categories,
  selected,
  onToggle,
  disabled,
}: CategoryPickerProps) {
  if (categories.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
        <Tag className="size-4" />
        <span>
          No categories yet —{' '}
          <a
            href="/admin/categories"
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            create one
          </a>{' '}
          to start grouping courses.
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((cat) => {
        const active = selected.has(cat.id)
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onToggle(cat.id)}
            disabled={disabled}
            aria-pressed={active}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              active
                ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
                : 'border-border bg-muted/40 text-foreground hover:bg-muted',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            {active ? (
              <Check className="size-3.5" />
            ) : (
              <Tag className="size-3.5 text-muted-foreground" />
            )}
            {cat.name}
          </button>
        )
      })}
    </div>
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

const ACCEPTED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
])

function ImagePicker({
  label,
  inputId,
  picker,
  aspectClass,
  helper,
  disabled,
  error,
}: ImagePickerProps) {
  const [isDragging, setIsDragging] = useState(false)
  const stillShowing = !!picker.file || (picker.hadExisting && !picker.cleared)

  function adoptFile(next: File | null) {
    if (!next) return
    if (!ACCEPTED_IMAGE_TYPES.has(next.type)) {
      toast.error(`${label} must be a PNG, JPEG, or WebP image`)
      return
    }
    picker.setFile(next)
    picker.setCleared(false)
  }

  function openFilePicker() {
    if (disabled) return
    picker.inputRef.current?.click()
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    // Only flag drags that carry files — ignores text/element drags.
    if (disabled) return
    if (!Array.from(e.dataTransfer.types).includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsDragging(true)
  }

  function onDragLeave(e: React.DragEvent<HTMLDivElement>) {
    // dragleave fires when entering child elements too; ignore those
    // by checking the related target is outside the container.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setIsDragging(false)
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    if (disabled) return
    e.preventDefault()
    setIsDragging(false)
    const next = e.dataTransfer.files?.[0] ?? null
    adoptFile(next)
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="space-y-3">
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={`${label} — drag and drop an image, or click to browse`}
          onClick={openFilePicker}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              openFilePicker()
            }
          }}
          onDragEnter={onDragOver}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            'group relative grid w-44 max-w-full cursor-pointer place-items-center overflow-hidden rounded-md border border-dashed bg-muted transition-colors',
            aspectClass,
            !disabled && 'hover:border-foreground/30 hover:bg-muted/70',
            isDragging && 'border-primary bg-primary/5 ring-2 ring-primary/30',
            error && 'border-destructive',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          {picker.preview ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={picker.preview}
                alt=""
                className="size-full object-cover"
              />
              {!disabled ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                  <Upload className="mr-1 size-3.5" />
                  Replace
                </div>
              ) : null}
            </>
          ) : (
            <div className="pointer-events-none flex flex-col items-center gap-1 px-3 text-center">
              {isDragging ? (
                <Upload className="size-7 text-primary" />
              ) : (
                <ImageIcon className="size-7 text-muted-foreground" />
              )}
              <span className="text-[11px] font-medium text-muted-foreground">
                {isDragging ? 'Drop to upload' : 'Drag & drop or click'}
              </span>
            </div>
          )}
        </div>
        <input
          ref={picker.inputRef}
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const next = e.target.files?.[0] ?? null
            adoptFile(next)
          }}
          disabled={disabled}
          className="sr-only"
        />
        <div className="flex flex-col gap-1">
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

// (Certificate template picker removed — superseded by the from-scratch
// generator in lib/services/certificate-service.ts. Admins now toggle
// `certificateEnabled` per course instead of uploading a template.)

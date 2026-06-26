'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Pin, Save } from 'lucide-react'
import { toast } from 'sonner'
import type {
  AnnouncementCategory,
  AnnouncementStatus,
} from '@prisma/client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { FormSection } from '@/components/shared'
import { cn } from '@/lib/utils'
import { ANNOUNCEMENT_CATEGORY_LABELS } from '@/lib/validations/announcement'

export interface AnnouncementFormSubmitResult {
  ok: boolean
  id?: string
  error?: string
  fieldErrors?: Record<string, string[]>
}

export interface AnnouncementFormDefaults {
  title?: string
  body?: string | null
  status?: AnnouncementStatus
  category?: AnnouncementCategory
  pinned?: boolean
  scheduledAt?: Date | null
}

interface AnnouncementFormProps {
  mode: 'create' | 'edit'
  defaults?: AnnouncementFormDefaults
  submitLabel: string
  onSubmit: (formData: FormData) => Promise<AnnouncementFormSubmitResult>
  destructiveAction?: React.ReactNode
  /** When false, the "Crosspost to Discord" option is hard-disabled
   *  and a warning links to settings. */
  discordWebhookConfigured: boolean
}

type FieldErrors = Partial<Record<string, string[]>>

function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-0.5 text-destructive">
      *
    </span>
  )
}

export function AnnouncementForm({
  mode,
  defaults,
  submitLabel,
  onSubmit,
  destructiveAction,
  discordWebhookConfigured,
}: AnnouncementFormProps) {
  const router = useRouter()

  const [title, setTitle] = useState(defaults?.title ?? '')
  const [body, setBody] = useState(defaults?.body ?? '')
  const [status, setStatus] = useState<AnnouncementStatus>(
    defaults?.status ?? 'DRAFT',
  )
  const [category, setCategory] = useState<AnnouncementCategory>(
    defaults?.category ?? 'GENERAL',
  )
  const [pinned, setPinned] = useState<boolean>(defaults?.pinned ?? false)
  // datetime-local format: YYYY-MM-DDTHH:mm — needed when status=SCHEDULED.
  const [scheduledAt, setScheduledAt] = useState<string>(() => {
    if (!defaults?.scheduledAt) return ''
    const d = new Date(defaults.scheduledAt)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  })
  // Email blast is opt-in per announcement so an admin can't ping
  // every member by accident. Disabled while the form is in Draft.
  const [notifyEmail, setNotifyEmail] = useState(false)
  // Discord crosspost is opt-in too. mentionEveryone defaults off so
  // the checkbox isn't a footgun — the admin has to deliberately opt
  // into @everyone-ing the whole server.
  const [notifyDiscord, setNotifyDiscord] = useState(false)
  const [discordMentionEveryone, setDiscordMentionEveryone] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError(null)
    setFieldErrors({})

    const trimmedTitle = title.trim()
    const trimmedBody = body.trim()
    const localErrors: FieldErrors = {}
    if (!trimmedTitle) localErrors.title = ['Title is required']
    else if (trimmedTitle.length > 200) localErrors.title = ['Title is too long']
    if (!trimmedBody) localErrors.body = ['Body is required']
    if (status === 'SCHEDULED') {
      if (!scheduledAt) {
        localErrors.scheduledAt = ['Pick a publish time']
      } else if (new Date(scheduledAt).getTime() <= Date.now()) {
        localErrors.scheduledAt = ['Scheduled time must be in the future']
      }
    }

    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors)
      return
    }

    const formData = new FormData()
    formData.set('title', trimmedTitle)
    formData.set('body', trimmedBody)
    formData.set('status', status)
    formData.set('category', category)
    formData.set('pinned', pinned ? '1' : '0')
    if (status === 'SCHEDULED' && scheduledAt) {
      formData.set('scheduledAt', new Date(scheduledAt).toISOString())
    }
    if (notifyEmail && status === 'PUBLISHED') {
      formData.set('notifyEmail', '1')
    }
    if (notifyDiscord && status === 'PUBLISHED') {
      formData.set('notifyDiscord', '1')
      if (discordMentionEveryone) {
        formData.set('discordMentionEveryone', '1')
      }
    }

    setSubmitting(true)
    try {
      const result = await onSubmit(formData)
      if (!result.ok) {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors)
        if (result.error) setFormError(result.error)
        return
      }
      toast.success(
        mode === 'create' ? 'Announcement created' : 'Announcement updated',
      )
      router.push('/admin/announcements')
    } catch (err) {
      console.error(err)
      setFormError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      <FormSection title="Content" description="What members will see.">
        <div className="space-y-2">
          <Label htmlFor="announcement-title">
            Title
            <RequiredMark />
          </Label>
          <Input
            id="announcement-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. New course just dropped"
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
          <Label htmlFor="announcement-body">
            Body
            <RequiredMark />
          </Label>
          <RichTextEditor
            id="announcement-body"
            value={body}
            onChange={setBody}
            placeholder="Write the announcement…"
            disabled={submitting}
          />
          {fieldErrors.body?.[0] && (
            <p className="text-xs text-destructive" role="alert">
              {fieldErrors.body[0]}
            </p>
          )}
        </div>
      </FormSection>

      <FormSection
        title="Visibility"
        description="Drafts stay admin-only. Scheduled rows auto-publish at the time you pick. Publishing now surfaces it to all members immediately."
      >
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <StatusOption
              active={status === 'DRAFT'}
              title="Draft"
              body="Save for now. Won't appear on the member side."
              onClick={() => setStatus('DRAFT')}
              disabled={submitting}
            />
            <StatusOption
              active={status === 'SCHEDULED'}
              title="Schedule"
              body="Auto-publishes at the chosen time."
              onClick={() => setStatus('SCHEDULED')}
              disabled={submitting}
            />
            <StatusOption
              active={status === 'PUBLISHED'}
              title="Publish"
              body="Goes live immediately."
              onClick={() => setStatus('PUBLISHED')}
              disabled={submitting}
            />
          </div>

          {status === 'SCHEDULED' ? (
            <div className="space-y-1.5">
              <Label htmlFor="scheduledAt">
                Publish time
                <RequiredMark />
              </Label>
              <Input
                id="scheduledAt"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                disabled={submitting}
                aria-invalid={!!fieldErrors.scheduledAt}
              />
              {fieldErrors.scheduledAt?.[0] && (
                <p className="text-xs text-destructive" role="alert">
                  {fieldErrors.scheduledAt[0]}
                </p>
              )}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as AnnouncementCategory)}
              >
                <SelectTrigger id="category" className="h-9" disabled={submitting}>
                  <SelectValue>
                    {(v: string) =>
                      ANNOUNCEMENT_CATEGORY_LABELS[
                        v as AnnouncementCategory
                      ] ?? 'General'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ANNOUNCEMENT_CATEGORY_LABELS) as AnnouncementCategory[]).map(
                    (key) => (
                      <SelectItem key={key} value={key}>
                        {ANNOUNCEMENT_CATEGORY_LABELS[key]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <label
              className={cn(
                'flex cursor-pointer items-start gap-2.5 rounded-md border bg-muted/30 p-3 text-sm',
                submitting && 'cursor-not-allowed opacity-60',
              )}
            >
              <Checkbox
                checked={pinned}
                onCheckedChange={(v) => setPinned(v === true)}
                disabled={submitting}
              />
              <div className="space-y-0.5">
                <p className="flex items-center gap-1.5 font-medium leading-none">
                  <Pin className="size-3.5" /> Pin to top
                </p>
                <p className="text-xs text-muted-foreground">
                  Pinned rows sort above everything else in the
                  member feed and the admin list.
                </p>
              </div>
            </label>
          </div>
          <label
            className={cn(
              'flex items-start gap-2.5 rounded-md border bg-muted/30 p-3 text-sm',
              status === 'PUBLISHED'
                ? 'cursor-pointer'
                : 'cursor-not-allowed opacity-60',
            )}
          >
            <Checkbox
              checked={notifyEmail}
              onCheckedChange={(v) => setNotifyEmail(v === true)}
              disabled={status !== 'PUBLISHED' || submitting}
            />
            <div className="space-y-0.5">
              <p className="font-medium leading-none">
                Send email blast to all active members
              </p>
              <p className="text-xs text-muted-foreground">
                Fires once on first publish. Only enabled while
                "Publish" is selected.
              </p>
            </div>
          </label>

          <div
            className={cn(
              'rounded-md border bg-muted/30',
              (status !== 'PUBLISHED' || !discordWebhookConfigured) &&
                'opacity-60',
            )}
          >
            <label
              className={cn(
                'flex items-start gap-2.5 p-3 text-sm',
                status === 'PUBLISHED' && discordWebhookConfigured
                  ? 'cursor-pointer'
                  : 'cursor-not-allowed',
              )}
            >
              <Checkbox
                checked={notifyDiscord && discordWebhookConfigured}
                onCheckedChange={(v) => setNotifyDiscord(v === true)}
                disabled={
                  status !== 'PUBLISHED' ||
                  !discordWebhookConfigured ||
                  submitting
                }
              />
              <div className="space-y-0.5">
                <p className="font-medium leading-none">
                  Crosspost to Discord
                </p>
                <p className="text-xs text-muted-foreground">
                  Posts an embed with the title, a preview, and a
                  "Read in Kondense" link. Fires once on first publish.
                </p>
              </div>
            </label>
            {!discordWebhookConfigured ? (
              <p
                role="alert"
                className="flex items-start gap-2 border-t border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
              >
                <AlertTriangle
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  No Discord webhook configured.{' '}
                  <Link
                    href="/admin/settings"
                    className="underline underline-offset-2 hover:text-destructive/80"
                  >
                    Set it up in Settings → Integrations
                  </Link>{' '}
                  to enable this option.
                </span>
              </p>
            ) : null}
            {notifyDiscord && status === 'PUBLISHED' && discordWebhookConfigured ? (
              <label className="flex cursor-pointer items-start gap-2.5 border-t px-3 py-2.5 text-sm">
                <Checkbox
                  checked={discordMentionEveryone}
                  onCheckedChange={(v) =>
                    setDiscordMentionEveryone(v === true)
                  }
                  disabled={submitting}
                />
                <div className="space-y-0.5">
                  <p className="font-medium leading-none">
                    Also @everyone
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pings the whole Discord server. Requires the
                    webhook to have "Mention @everyone" permission.
                  </p>
                </div>
              </label>
            ) : null}
          </div>
        </div>
      </FormSection>

      {formError ? (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>{destructiveAction}</div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push('/admin/announcements')}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            <Save />
            {submitting ? 'Saving…' : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  )
}

function StatusOption({
  active,
  title,
  body,
  onClick,
  disabled,
}: {
  active: boolean
  title: string
  body: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col gap-1 rounded-md border px-3 py-2.5 text-left transition-colors',
        active
          ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/40'
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

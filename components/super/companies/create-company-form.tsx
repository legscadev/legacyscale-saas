'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  Copy,
  FileText,
  Loader2,
  ShieldCheck,
  UserCheck,
  UserPlus,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

import type {
  OwnerLookup,
  SnapshotSourceOption,
} from '@/app/(super)/super/companies/actions'
import {
  createCompanyAction,
  lookupOwnerAction,
} from '@/app/(super)/super/companies/actions'

type FieldErrors = Partial<
  Record<
    'name' | 'slug' | 'ownerEmail' | 'ownerName' | 'snapshotFromCompanyId',
    string[]
  >
>

// Live slug suggestion — same normalisation the server does on submit.
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

interface CreateCompanyFormProps {
  snapshotSources: SnapshotSourceOption[]
}

const NONE_SOURCE = '__blank__'

type OwnerMode = 'self' | 'other'

export function CreateCompanyForm({
  snapshotSources,
}: CreateCompanyFormProps) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [ownerMode, setOwnerMode] = useState<OwnerMode>('self')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [snapshotSource, setSnapshotSource] = useState<string>(NONE_SOURCE)
  const [pending, setPending] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [ownerLookup, setOwnerLookup] = useState<OwnerLookup | null>(null)
  const [lookupPending, setLookupPending] = useState(false)

  const effectiveSlug = slugTouched ? slug : slugify(name)

  // Debounced live lookup — as the operator types, ask the server
  // "what will this email resolve to?" so the preview chip can say
  // whether we're minting a fresh admin, attaching an existing user
  // (and promoting them), or rejecting a deleted one. 400ms debounce
  // keeps us from hammering the DB per keystroke. A `cancelled` flag
  // per effect run drops any response whose request was superseded
  // by a newer email (otherwise a slow response for a stale email
  // could overwrite the preview and show the wrong user).
  useEffect(() => {
    if (ownerMode !== 'other') {
      setOwnerLookup(null)
      return
    }
    const raw = ownerEmail.trim()
    if (raw === '') {
      setOwnerLookup(null)
      return
    }
    setLookupPending(true)
    let cancelled = false
    const handle = setTimeout(async () => {
      try {
        const result = await lookupOwnerAction(raw)
        if (cancelled) return
        setOwnerLookup(result)
      } catch {
        if (cancelled) return
        setOwnerLookup(null)
      } finally {
        if (!cancelled) setLookupPending(false)
      }
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [ownerEmail, ownerMode])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFieldErrors({})
    setPending(true)
    try {
      const result = await createCompanyAction({
        name,
        slug: effectiveSlug,
        // Blank ownerEmail = self-assign path (server fills in the
        // caller's email + skips the notification).
        ownerEmail: ownerMode === 'self' ? '' : ownerEmail,
        ownerName: ownerMode === 'self' ? '' : ownerName,
        snapshotFromCompanyId:
          snapshotSource === NONE_SOURCE ? undefined : snapshotSource,
      })
      if (!result.ok) {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors)
        if (result.error) toast.error(result.error)
        return
      }
      // Success — narrate the outcome so the toast reflects what
      // actually happened. Snapshot failure after a successful
      // create is common enough (transient DB timeouts on huge
      // catalogs) that it needs its own callout instead of being
      // swallowed by the generic success path.
      if (result.snapshotError) {
        toast.warning(
          `Company created but snapshot failed: ${result.snapshotError}. You can re-run it from the company row.`,
        )
      } else if (result.snapshot) {
        toast.success(
          `Company created — cloned ${result.snapshot.coursesCopied} courses, ${result.snapshot.lessonsCopied} lessons, and ${result.snapshot.categoriesCopied} categories`,
        )
      } else {
        toast.success(
          result.ownerWasNewlyCreated
            ? 'Company created and owner invited'
            : 'Company created',
        )
      }
      router.push('/super/companies')
      router.refresh()
    } catch (err) {
      console.error(err)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-6">
      <div>
        <Link
          href="/super/companies"
          className="inline-flex items-center gap-1.5 -ml-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          All companies
        </Link>
      </div>

      <FormRow
        id="company-name"
        label="Name"
        description="Display name shown across the admin console and public surfaces."
        error={fieldErrors.name}
      >
        <Input
          id="company-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sunrise Fitness"
          disabled={pending}
          autoFocus
          required
        />
      </FormRow>

      <FormRow
        id="company-slug"
        label="Slug"
        description="URL-safe handle. Used in internal routing and the future company sign-in URL."
        error={fieldErrors.slug}
      >
        <Input
          id="company-slug"
          value={effectiveSlug}
          onChange={(e) => {
            setSlug(e.target.value)
            setSlugTouched(true)
          }}
          placeholder="e.g. sunrise-fitness"
          disabled={pending}
          required
          className="font-mono"
        />
      </FormRow>

      <div className="space-y-4 rounded-lg border p-4">
        <div>
          <p className="text-sm font-semibold">Initial owner</p>
          <p className="text-xs text-muted-foreground">
            Every tenant must have an OWNER. Own it yourself, or hand
            it to someone else — we&apos;ll email them a heads-up.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <OwnerModeOption
            checked={ownerMode === 'self'}
            onClick={() => setOwnerMode('self')}
            icon={<ShieldCheck className="size-4" />}
            title="I'll own it myself"
            description="You'll be recorded as OWNER. No email is sent."
            disabled={pending}
          />
          <OwnerModeOption
            checked={ownerMode === 'other'}
            onClick={() => setOwnerMode('other')}
            icon={<UserPlus className="size-4" />}
            title="Assign to another person"
            description="Enter their email. Fresh emails get a full invite; existing users get a heads-up."
            disabled={pending}
          />
        </div>

        {ownerMode === 'other' ? (
          <>
            <FormRow
              id="owner-email"
              label="Email"
              error={fieldErrors.ownerEmail}
            >
              <Input
                id="owner-email"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="owner@example.com"
                disabled={pending}
                required
              />
            </FormRow>
            <OwnerPreview lookup={ownerLookup} pending={lookupPending} />
            <FormRow
              id="owner-name"
              label="Name"
              description="Optional. Used only when creating a fresh account."
              error={fieldErrors.ownerName}
            >
              <Input
                id="owner-name"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Jamie Rivera"
                disabled={pending}
              />
            </FormRow>
          </>
        ) : null}
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <div>
          <p className="text-sm font-semibold">Starting content</p>
          <p className="text-xs text-muted-foreground">
            Start blank, or clone the courses + categories from another
            tenant. Cloned content lands as DRAFT so the new owner can
            review before publishing. Videos + files aren't carried
            over — those need to be re-uploaded.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <SourceOption
            checked={snapshotSource === NONE_SOURCE}
            onClick={() => setSnapshotSource(NONE_SOURCE)}
            icon={<FileText className="size-4" />}
            title="Start blank"
            description="A fresh tenant with no courses, categories, or modules."
            disabled={pending}
          />
          <SourceOption
            checked={snapshotSource !== NONE_SOURCE}
            onClick={() => {
              if (snapshotSources[0]) setSnapshotSource(snapshotSources[0].id)
            }}
            icon={<Copy className="size-4" />}
            title="Clone from another tenant"
            description={
              snapshotSources.length === 0
                ? 'No other tenants exist yet — nothing to clone from.'
                : `Copy the catalog from one of ${snapshotSources.length} eligible tenants.`
            }
            disabled={pending || snapshotSources.length === 0}
          />
        </div>
        {snapshotSource !== NONE_SOURCE && snapshotSources.length > 0 ? (
          <div className="space-y-1.5">
            <Label htmlFor="snapshot-source">Source tenant</Label>
            <Select
              value={snapshotSource}
              onValueChange={(v) => setSnapshotSource(v ?? NONE_SOURCE)}
              disabled={pending}
            >
              <SelectTrigger id="snapshot-source" className="w-full">
                <SelectValue placeholder="Pick a tenant to clone from">
                  {(() => {
                    const s = snapshotSources.find((x) => x.id === snapshotSource)
                    if (!s) return 'Pick a tenant to clone from'
                    return `${s.name}${s.isAgency ? ' · Agency' : ''}`
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {snapshotSources.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                    {s.isAgency ? ' · Agency' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.snapshotFromCompanyId ? (
              <p className="text-xs text-destructive">
                {fieldErrors.snapshotFromCompanyId[0]}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="animate-spin" />
              {snapshotSource !== NONE_SOURCE ? 'Creating + cloning…' : 'Creating…'}
            </>
          ) : (
            'Create company'
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => router.push('/super/companies')}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}

interface SourceOptionProps {
  checked: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  description: string
  disabled?: boolean
}

function SourceOption({
  checked,
  onClick,
  icon,
  title,
  description,
  disabled,
}: SourceOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-start gap-3 rounded-md border p-3 text-left transition-colors',
        checked
          ? 'border-primary/50 bg-primary/[0.04]'
          : 'hover:border-input hover:bg-muted/40',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <span
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-md',
          checked
            ? 'bg-primary/15 text-primary'
            : 'bg-muted text-muted-foreground',
        )}
      >
        {icon}
      </span>
      <div className="space-y-0.5">
        <p className="text-sm font-medium leading-none">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  )
}

interface FormRowProps {
  id: string
  label: string
  description?: string
  error?: string[]
  children: React.ReactNode
}

function FormRow({ id, label, description, error, children }: FormRowProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
      {error && error.length > 0 ? (
        <p className="text-xs text-destructive">{error[0]}</p>
      ) : null}
    </div>
  )
}

// Reuses SourceOption's visual language for consistency; kept as a
// separate component so the icon + copy variants for owner-mode stay
// clear at the call site.
function OwnerModeOption(props: SourceOptionProps) {
  return <SourceOption {...props} />
}

interface OwnerPreviewProps {
  lookup: OwnerLookup | null
  pending: boolean
}

/**
 * Chip that appears under the owner-email input, adapting to what the
 * server says about the typed email. Four states:
 *   - loading            → grey pulse while the debounced fetch runs
 *   - fresh              → "will mint an admin + email an invite"
 *   - existing (regular) → shows the user's real name + role + whether
 *                          we'll promote them
 *   - existing (super)   → callout that this doesn't change access,
 *                          just records ownership
 *   - deleted            → red block: refuse
 * Null lookup = nothing typed yet, render nothing.
 */
function OwnerPreview({ lookup, pending }: OwnerPreviewProps) {
  if (pending) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Checking…
      </div>
    )
  }
  if (!lookup || lookup.status === 'invalid') return null

  if (lookup.status === 'deleted') {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/[0.06] px-3 py-2 text-xs text-destructive">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        <span>
          This email belongs to a soft-deleted user. Restore that account
          or pick a different email.
        </span>
      </div>
    )
  }
  if (lookup.status === 'fresh') {
    return (
      <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/[0.04] px-3 py-2 text-xs">
        <UserPlus className="mt-0.5 size-3.5 shrink-0 text-primary" />
        <span>
          <span className="font-medium">Fresh account.</span> We&apos;ll
          create it, promote to admin, and email a &quot;you&apos;re
          the owner&quot; invite with a password-set link.
        </span>
      </div>
    )
  }
  // existing
  const displayName = lookup.name ?? lookup.email.split('@')[0]
  if (lookup.isSuperAdmin) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/[0.06] px-3 py-2 text-xs">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
        <span>
          <span className="font-medium">{displayName}</span> is a
          super-admin — they can already enter every tenant. This
          records them as OWNER on paper + emails a heads-up. No
          access change.
        </span>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-2 rounded-md border px-3 py-2 text-xs">
      <UserCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
      <span>
        <span className="font-medium">{displayName}</span> already has
        an account ({lookup.globalRole.toLowerCase()}).{' '}
        {lookup.willPromote
          ? 'We’ll promote them to admin so they can enter the tenant, and email a heads-up.'
          : 'We’ll add OWNER membership + email a heads-up.'}
      </span>
    </div>
  )
}

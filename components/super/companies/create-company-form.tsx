'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Copy, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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

import type { SnapshotSourceOption } from '@/app/(super)/super/companies/actions'
import { createCompanyAction } from '@/app/(super)/super/companies/actions'

type FieldErrors = Partial<
  Record<
    'name' | 'slug' | 'isAgency' | 'ownerEmail' | 'ownerName' | 'snapshotFromCompanyId',
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

export function CreateCompanyForm({
  snapshotSources,
}: CreateCompanyFormProps) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [isAgency, setIsAgency] = useState(false)
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [snapshotSource, setSnapshotSource] = useState<string>(NONE_SOURCE)
  const [pending, setPending] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const effectiveSlug = slugTouched ? slug : slugify(name)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFieldErrors({})
    setPending(true)
    try {
      const result = await createCompanyAction({
        name,
        slug: effectiveSlug,
        isAgency,
        ownerEmail,
        ownerName,
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

      <label
        htmlFor="company-agency"
        className={cn(
          'flex cursor-pointer select-none items-start gap-3 rounded-md border p-3 transition-colors',
          isAgency && 'border-primary/40 bg-primary/[0.04]',
        )}
      >
        <Checkbox
          id="company-agency"
          checked={isAgency}
          onCheckedChange={(v) => setIsAgency(v === true)}
          disabled={pending}
        />
        <div className="space-y-0.5">
          <p className="text-sm font-medium leading-none">
            This is an agency
          </p>
          <p className="text-xs text-muted-foreground">
            Agencies run their own sub-accounts. Sub-account creation +
            snapshot cloning becomes visible from an agency's admin
            console.
          </p>
        </div>
      </label>

      <div className="space-y-4 rounded-lg border p-4">
        <div>
          <p className="text-sm font-semibold">Initial owner</p>
          <p className="text-xs text-muted-foreground">
            The first user with OWNER role on this company. If the email
            isn't registered yet, we'll create an account + send a
            welcome mail.
          </p>
        </div>
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
              <SelectTrigger id="snapshot-source">
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

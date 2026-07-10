'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import { createCompanyAction } from '@/app/(super)/super/companies/actions'

type FieldErrors = Partial<
  Record<'name' | 'slug' | 'isAgency' | 'ownerEmail' | 'ownerName', string[]>
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

export function CreateCompanyForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [isAgency, setIsAgency] = useState(false)
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerName, setOwnerName] = useState('')
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
      })
      if (!result.ok) {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors)
        if (result.error) toast.error(result.error)
        return
      }
      toast.success(
        result.ownerWasNewlyCreated
          ? 'Company created and owner invited'
          : 'Company created',
      )
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
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
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

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="animate-spin" />
              Creating…
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

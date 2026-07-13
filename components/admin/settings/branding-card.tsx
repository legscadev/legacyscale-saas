'use client'

import { useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { BrandingSaveResult } from '@/app/(admin)/admin/settings/branding-actions'
import type { BrandingInput } from '@/lib/branding/schema'

interface BrandingCardProps {
  initial: BrandingInput | null
  action: (fd: FormData) => Promise<BrandingSaveResult>
}

interface FieldConfig {
  id: keyof BrandingInput
  label: string
  placeholder: string
  type?: string
  pattern?: string
  hint?: string
}

// Ordered so the form reads top-down: naming → contact → visual.
const FIELDS: FieldConfig[] = [
  { id: 'productName', label: 'Product name', placeholder: 'Kondense' },
  {
    id: 'tagline',
    label: 'Tagline',
    placeholder: 'Agency Education Platform',
    hint: 'Used as the browser tab description and email preheader.',
  },
  {
    id: 'supportEmail',
    label: 'Support email',
    placeholder: 'support@kondense.ai',
    type: 'email',
  },
  {
    id: 'fromName',
    label: "Email 'from' name",
    placeholder: 'Kondense',
    hint: 'Shown as the sender name on transactional emails.',
  },
  {
    id: 'legalCompany',
    label: 'Legal company name',
    placeholder: 'Kondense',
    hint: 'Renders in email footers and PDF certificates.',
  },
  {
    id: 'primaryColor',
    label: 'Primary color (hex)',
    placeholder: '#d11a1a',
    pattern: '^#[0-9a-fA-F]{6}$',
    hint: 'Six-digit hex, e.g. #d11a1a.',
  },
  {
    id: 'logoUrl',
    label: 'Logo URL',
    placeholder: 'https://cdn.example.com/logo.png',
    type: 'url',
    hint: 'Public URL. Storage-backed uploads come in a later phase.',
  },
]

export function BrandingCard({ initial, action }: BrandingCardProps) {
  const [isSaving, startSaving] = useTransition()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding</CardTitle>
        <CardDescription>
          These values render across the app — sidebar wordmark, browser
          title, emails, PDFs. Leave a field blank to fall back to the
          platform default.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={(fd) => {
            startSaving(async () => {
              const result = await action(fd)
              if (result.ok) toast.success('Branding saved')
              else toast.error(result.error ?? 'Could not save branding')
            })
          }}
          className="space-y-4"
        >
          {FIELDS.map((f) => (
            <div key={f.id} className="space-y-2">
              <Label htmlFor={f.id}>{f.label}</Label>
              <Input
                id={f.id}
                name={f.id}
                type={f.type ?? 'text'}
                pattern={f.pattern}
                placeholder={f.placeholder}
                defaultValue={initial?.[f.id] ?? ''}
              />
              {f.hint && (
                <p className="text-xs text-muted-foreground">{f.hint}</p>
              )}
            </div>
          ))}

          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save branding'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

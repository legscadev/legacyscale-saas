'use client'

import { useTransition } from 'react'
import { Award, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { downloadCertificateAction } from '@/app/(user)/certificates/actions'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { CertificateListItem } from '@/lib/services/certificate-service'

interface CertificatesListProps {
  items: CertificateListItem[]
}

export function CertificatesList({ items }: CertificatesListProps) {
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <li key={item.id}>
          <CertificateRow item={item} />
        </li>
      ))}
    </ul>
  )
}

interface CertificateRowProps {
  item: CertificateListItem
}

function CertificateRow({ item }: CertificateRowProps) {
  const [pending, startTransition] = useTransition()

  function handleDownload() {
    startTransition(async () => {
      const result = await downloadCertificateAction(item.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      window.open(result.url, '_blank', 'noopener')
    })
  }

  return (
    <Card className="flex h-full flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-100 text-brand-600 ring-1 ring-brand-200/50">
          <Award className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold leading-tight">
            {item.moduleTitle}
          </h2>
          <p className="truncate text-sm text-muted-foreground">
            {item.courseTitle}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-muted-foreground">Issued</dt>
          <dd className="font-medium">{formatIssuedAt(item.issuedAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Cert #</dt>
          <dd className="font-mono font-medium tracking-wide">
            {item.shortCode}
          </dd>
        </div>
      </dl>

      <div className="mt-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={pending}
          className="w-full"
        >
          {pending ? <Loader2 className="animate-spin" /> : <Award />}
          {pending ? 'Preparing…' : 'Download PDF'}
        </Button>
      </div>
    </Card>
  )
}

function formatIssuedAt(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}

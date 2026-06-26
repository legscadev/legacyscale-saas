'use client'

import { useTransition } from 'react'
import { Award, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { getCertificateUrlAction } from '@/app/(user)/courses/[slug]/complete/actions'

interface CertificateDownloadButtonProps {
  enrollmentId: string
  /** Optional visual variant. Defaults to a primary CTA — also used
   *  on the course detail page where it sits next to "Continue
   *  learning" so should stay prominent. */
  variant?: 'default' | 'outline'
  className?: string
}

/**
 * Single-button trigger that asks the server for a short-lived signed
 * URL and opens it. The action generates the PDF on the first call,
 * then caches it — so subsequent clicks are near-instant.
 *
 * Always rendered conditionally (caller checks course has a template
 * + the enrollment is completed). The action itself also gates on
 * completedAt, so a malicious click still won't return a URL.
 */
export function CertificateDownloadButton({
  enrollmentId,
  variant = 'default',
  className,
}: CertificateDownloadButtonProps) {
  const [pending, startDownload] = useTransition()

  function handleClick() {
    startDownload(async () => {
      const result = await getCertificateUrlAction(enrollmentId)
      if (!result.ok || !result.url) {
        toast.error(result.error ?? 'Could not download certificate')
        return
      }
      // window.open with the signed URL — the URL has download=<name>
      // baked in via Supabase's createSignedUrl options, so the browser
      // will trigger a Save-as / download instead of opening in a tab.
      window.open(result.url, '_blank', 'noopener')
    })
  }

  return (
    <Button
      variant={variant}
      onClick={handleClick}
      disabled={pending}
      aria-live="polite"
      className={className}
    >
      {pending ? <Loader2 className="animate-spin" /> : <Award />}
      {pending ? 'Preparing…' : 'Download certificate'}
    </Button>
  )
}

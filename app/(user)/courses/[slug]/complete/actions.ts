'use server'

import { requireActiveUser } from '@/lib/auth'
import { generateOrFetchCertificate } from '@/lib/services/certificate-service'

export interface CertificateDownloadResult {
  ok: boolean
  url?: string
  filename?: string
  error?: string
}

/**
 * Generate (if needed) + return a short-lived signed download URL
 * for the current user's completion certificate. Lazy generation is
 * handled inside the service — the first call for an enrollment
 * stamps the PDF and uploads it; subsequent calls just re-sign the
 * cached file.
 *
 * Authorization: the service checks that the enrollment belongs to
 * the calling user and that it has a completedAt timestamp before
 * generating anything.
 */
export async function getCertificateUrlAction(
  enrollmentId: string,
): Promise<CertificateDownloadResult> {
  const user = await requireActiveUser()
  const result = await generateOrFetchCertificate(user.id, enrollmentId)
  if (!result.ok) return result
  return { ok: true, url: result.url, filename: result.filename }
}

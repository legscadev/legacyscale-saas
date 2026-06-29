'use server'

import { requireActiveUser } from '@/lib/auth'
import {
  getCertificateDownload,
  type CertificateDownloadError,
  type CertificateDownloadResult,
} from '@/lib/services/certificate-service'

export type CertificateDownloadActionResult =
  | { ok: true; url: string; filename: string }
  | { ok: false; error: string }

/**
 * Sign and return a short-lived URL for the given certificate
 * issuance. The service authorizes against the calling user and
 * lazy-renders the PDF on first request.
 */
export async function downloadCertificateAction(
  issuanceId: string,
): Promise<CertificateDownloadActionResult> {
  const user = await requireActiveUser()
  const result: CertificateDownloadResult | CertificateDownloadError =
    await getCertificateDownload(user.id, issuanceId)
  if (!result.ok) return result
  return { ok: true, url: result.url, filename: result.filename }
}

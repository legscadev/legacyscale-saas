// Admin-side certificate management.
//
// Powers /admin/certificates. Ruby (admin) needs to:
//   1. See every issuance across all members (with filters).
//   2. Download any cert for support / re-upload elsewhere.
//   3. Email the cert to the member as a PDF attachment.
//   4. Hand-issue a cert (bypass the module-completion gate) for
//      support edge cases.
//   5. Revoke a wrong-issue so it disappears from the member's view
//      and can no longer be downloaded.
//
// All writes are gated on ADMIN role at the caller layer. This
// service assumes the caller already checked authz.

import { CertificateDeliveryEmail } from '@/emails'
import { getBranding } from '@/lib/branding/get-branding'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/resend'
import { getCertificatePdfBytes } from '@/lib/services/certificate-service'
import { createAdminClient } from '@/lib/supabase/admin'
import { tenantPrefixCandidates } from '@/lib/tenancy/storage-path'

const CERTIFICATE_BUCKET = 'course-certificates'
const SIGNED_URL_TTL_SEC = 60 * 10

const SHORT_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const SHORT_CODE_LENGTH = 8
const SHORT_CODE_MAX_ATTEMPTS = 5

export type CertificateStatusFilter = 'all' | 'active' | 'revoked'

export interface AdminCertificateFilters {
  memberId?: string
  courseId?: string
  status?: CertificateStatusFilter
  /** Case-insensitive substring match on member email/name or
   *  module/course title. Cheap enough for the current volume. */
  search?: string
}

export interface AdminCertificateRow {
  id: string
  shortCode: string
  issuedAt: Date
  revokedAt: Date | null
  revokedReason: string | null
  manuallyIssued: boolean
  member: { id: string; name: string | null; email: string }
  module: { id: string; title: string }
  course: { id: string; title: string }
}

// ============================================================
// LIST
// ============================================================

export async function listAllCertificates(
  filters: AdminCertificateFilters = {},
): Promise<AdminCertificateRow[]> {
  const status = filters.status ?? 'all'
  const rows = await prisma.certificateIssuance.findMany({
    where: {
      ...(filters.memberId ? { userId: filters.memberId } : {}),
      ...(filters.courseId ? { courseId: filters.courseId } : {}),
      ...(status === 'active' ? { revokedAt: null } : {}),
      ...(status === 'revoked' ? { revokedAt: { not: null } } : {}),
      ...(filters.search
        ? {
            OR: [
              { user: { email: { contains: filters.search, mode: 'insensitive' } } },
              { user: { name: { contains: filters.search, mode: 'insensitive' } } },
              { module: { title: { contains: filters.search, mode: 'insensitive' } } },
              { course: { title: { contains: filters.search, mode: 'insensitive' } } },
              { shortCode: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { issuedAt: 'desc' },
    select: {
      id: true,
      shortCode: true,
      issuedAt: true,
      revokedAt: true,
      revokedReason: true,
      manuallyIssuedById: true,
      user: { select: { id: true, name: true, email: true } },
      module: { select: { id: true, title: true } },
      course: { select: { id: true, title: true } },
    },
  })

  return rows.map((r) => ({
    id: r.id,
    shortCode: r.shortCode,
    issuedAt: r.issuedAt,
    revokedAt: r.revokedAt,
    revokedReason: r.revokedReason,
    manuallyIssued: r.manuallyIssuedById !== null,
    member: r.user,
    module: r.module,
    course: r.course,
  }))
}

// ============================================================
// REVOKE
// ============================================================

export async function revokeCertificate(
  adminId: string,
  issuanceId: string,
  reason: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await prisma.certificateIssuance.findUnique({
    where: { id: issuanceId },
    select: { id: true, revokedAt: true },
  })
  if (!existing) return { ok: false, error: 'Certificate not found' }
  if (existing.revokedAt) return { ok: false, error: 'Certificate is already revoked' }

  await prisma.certificateIssuance.update({
    where: { id: issuanceId },
    data: {
      revokedAt: new Date(),
      revokedById: adminId,
      revokedReason: reason?.trim() || null,
    },
  })
  return { ok: true }
}

/**
 * Reverse a revocation. Kept in case Ruby revokes by mistake — clears
 * the trio so the cert is visible + downloadable again.
 */
export async function reinstateCertificate(
  issuanceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await prisma.certificateIssuance.findUnique({
    where: { id: issuanceId },
    select: { id: true, revokedAt: true },
  })
  if (!existing) return { ok: false, error: 'Certificate not found' }
  if (!existing.revokedAt) return { ok: false, error: 'Certificate is not revoked' }

  await prisma.certificateIssuance.update({
    where: { id: issuanceId },
    data: { revokedAt: null, revokedById: null, revokedReason: null },
  })
  return { ok: true }
}

// ============================================================
// MANUAL ISSUE (bypass module-completion gate)
// ============================================================

export interface ManualIssueInput {
  userId: string
  moduleId: string
}

export interface BulkIssueOutcome {
  moduleId: string
  status: 'issued' | 'already-active' | 'revoked-exists' | 'module-missing'
  issuanceId?: string
}

/**
 * Bulk variant of manuallyIssueCertificate. Iterates the module list
 * and issues each one, returning per-module outcomes so the UI can
 * tell the admin which ones succeeded, which already existed, and
 * which need reinstating.
 */
export async function manuallyIssueBulkCertificates(
  adminId: string,
  userId: string,
  moduleIds: string[],
): Promise<
  | { ok: true; results: BulkIssueOutcome[]; issuedCount: number }
  | { ok: false; error: string }
> {
  if (moduleIds.length === 0) {
    return { ok: false, error: 'Pick at least one module' }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })
  if (!user) return { ok: false, error: 'Member not found' }

  const results: BulkIssueOutcome[] = []
  let issuedCount = 0
  for (const moduleId of moduleIds) {
    const result = await manuallyIssueCertificate(adminId, { userId, moduleId })
    if (result.ok) {
      results.push({ moduleId, status: 'issued', issuanceId: result.issuanceId })
      issuedCount++
    } else if (/already exists/.test(result.error)) {
      results.push({ moduleId, status: 'already-active' })
    } else if (/revoked/.test(result.error)) {
      results.push({ moduleId, status: 'revoked-exists' })
    } else {
      results.push({ moduleId, status: 'module-missing' })
    }
  }
  return { ok: true, results, issuedCount }
}

export async function manuallyIssueCertificate(
  adminId: string,
  input: ManualIssueInput,
): Promise<{ ok: true; issuanceId: string } | { ok: false; error: string }> {
  const mod = await prisma.module.findFirst({
    where: { id: input.moduleId, deletedAt: null },
    select: { id: true, courseId: true },
  })
  if (!mod) return { ok: false, error: 'Module not found' }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, isActive: true },
  })
  if (!user) return { ok: false, error: 'Member not found' }

  const existing = await prisma.certificateIssuance.findUnique({
    where: { userId_moduleId: { userId: input.userId, moduleId: input.moduleId } },
    select: { id: true, revokedAt: true },
  })
  if (existing) {
    if (existing.revokedAt) {
      return {
        ok: false,
        error: 'A revoked certificate already exists for this member + module. Reinstate it instead.',
      }
    }
    return { ok: false, error: 'Certificate already exists for this member + module' }
  }

  for (let attempt = 0; attempt < SHORT_CODE_MAX_ATTEMPTS; attempt++) {
    try {
      const created = await prisma.certificateIssuance.create({
        data: {
          userId: input.userId,
          moduleId: input.moduleId,
          courseId: mod.courseId,
          shortCode: generateShortCode(),
          manuallyIssuedById: adminId,
        },
        select: { id: true },
      })
      return { ok: true, issuanceId: created.id }
    } catch (err) {
      if (isShortCodeCollision(err)) continue
      throw err
    }
  }
  return { ok: false, error: 'Could not allocate certificate short code' }
}

// ============================================================
// EMAIL TO MEMBER
// ============================================================

export async function emailCertificateToMember(
  issuanceId: string,
): Promise<{ ok: true; messageId?: string } | { ok: false; error: string }> {
  const issuance = await prisma.certificateIssuance.findUnique({
    where: { id: issuanceId },
    select: {
      id: true,
      shortCode: true,
      revokedAt: true,
      user: { select: { name: true, email: true } },
      module: { select: { title: true } },
      course: { select: { title: true } },
    },
  })
  if (!issuance) return { ok: false, error: 'Certificate not found' }
  if (issuance.revokedAt) {
    return { ok: false, error: 'Cannot email a revoked certificate' }
  }

  const bytes = await getCertificatePdfBytes(issuanceId)
  if (!bytes) return { ok: false, error: 'Could not generate certificate PDF' }

  const memberName =
    issuance.user.name?.trim() ||
    issuance.user.email.split('@')[0] ||
    'there'
  const filename = safeFilename(issuance.module.title)

  const branding = await getBranding()
  try {
    const { id } = await sendEmail({
      to: issuance.user.email,
      subject: `Your certificate: ${issuance.module.title}`,
      purpose: 'notifications',
      fromName: branding.fromName,
      react: CertificateDeliveryEmail({
        name: memberName,
        moduleTitle: issuance.module.title,
        courseTitle: issuance.course.title,
        shortCode: issuance.shortCode,
        branding,
      }),
      attachments: [
        {
          filename,
          content: Buffer.from(bytes),
          contentType: 'application/pdf',
        },
      ],
    })
    return { ok: true, messageId: id }
  } catch (err) {
    console.error('Certificate email failed:', err)
    return { ok: false, error: 'Email send failed' }
  }
}

// ============================================================
// ADMIN DOWNLOAD  (signed URL for any cert, revoked or not)
// ============================================================

export async function getAdminCertificateDownload(
  issuanceId: string,
): Promise<
  | { ok: true; url: string; filename: string }
  | { ok: false; error: string }
> {
  const issuance = await prisma.certificateIssuance.findUnique({
    where: { id: issuanceId },
    select: { module: { select: { title: true } } },
  })
  if (!issuance) return { ok: false, error: 'Certificate not found' }

  // Force render + upload if needed so the file exists in storage.
  const bytes = await getCertificatePdfBytes(issuanceId)
  if (!bytes) return { ok: false, error: 'Could not generate certificate PDF' }

  const supabase = createAdminClient()
  const filename = safeFilename(issuance.module.title)
  // getCertificatePdfBytes above ensures the PDF exists at ONE of the
  // candidate paths (prefixed for new files, bare for pre-tenancy).
  // Probe both and sign whichever we find.
  const candidates = await tenantPrefixCandidates(`${issuanceId}.pdf`)
  let certPath: string | null = null
  for (const candidate of candidates) {
    const { data: existing } = await supabase.storage
      .from(CERTIFICATE_BUCKET)
      .list('', { search: candidate, limit: 1 })
    if (existing?.some((f) => f.name === candidate)) {
      certPath = candidate
      break
    }
  }
  if (!certPath) {
    console.error('Admin cert path lookup missed both prefixed and bare')
    return { ok: false, error: 'Could not locate certificate PDF' }
  }
  const { data, error } = await supabase.storage
    .from(CERTIFICATE_BUCKET)
    .createSignedUrl(certPath, SIGNED_URL_TTL_SEC, {
      download: filename,
    })
  if (error || !data) {
    console.error('Admin cert signed URL failed:', error)
    return { ok: false, error: 'Could not generate download link' }
  }
  return { ok: true, url: data.signedUrl, filename }
}

// ============================================================
// INTERNALS
// ============================================================

function generateShortCode(): string {
  let out = ''
  for (let i = 0; i < SHORT_CODE_LENGTH; i++) {
    out += SHORT_CODE_ALPHABET[
      Math.floor(Math.random() * SHORT_CODE_ALPHABET.length)
    ]
  }
  return out
}

function isShortCodeCollision(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code = (err as { code?: string }).code
  const meta = (err as { meta?: { target?: string | string[] } }).meta
  if (code !== 'P2002') return false
  const target = Array.isArray(meta?.target)
    ? meta!.target.join(',')
    : meta?.target
  return target?.includes('short_code') ?? false
}

function safeFilename(title: string): string {
  const safe = title.replace(/[^a-zA-Z0-9 -]+/g, '').trim() || 'Certificate'
  return `${safe} — Certificate.pdf`
}

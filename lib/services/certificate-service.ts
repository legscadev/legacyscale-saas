// Per-module completion certificates.
//
// Certificates are scoped to a Module (the top-level grouping above
// chapters). When a member finishes the last lesson of the last
// chapter of a module — and the course has certificateEnabled — a
// row is written to certificate_issuances. That row is the source
// of truth; the PDF itself is rendered lazily on first download and
// cached in the `course-certificates` Storage bucket under
// `<issuance-id>.pdf`.
//
// Three external entry points:
//   1. issueModuleCertificateIfEligible — called from the lesson
//      progress hook after every "mark complete". Idempotent via
//      the (user_id, module_id) unique constraint.
//   2. listUserCertificates — powers /certificates. Also runs a
//      cheap backfill so modules completed before this feature
//      shipped still get a certificate the moment a member visits.
//   3. getCertificateDownload — signs a short-lived URL for an
//      issuance, generating + uploading the PDF on first call.
//
// The PDF stamps the module title only — the course is shown for
// context inside /certificates but doesn't ride on the artifact.

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

import { getBranding } from '@/lib/branding/get-branding'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenantPrefix } from '@/lib/tenancy/storage-path'

const CERTIFICATE_BUCKET = 'course-certificates'
const SIGNED_URL_TTL_SEC = 60 * 10 // 10 min — plenty for click-to-download

// Template path. Bundled via public/ so process.cwd() resolves it
// at runtime on both local dev and Vercel.
const TEMPLATE_PATH = path.join(
  process.cwd(),
  'public',
  'cert-template.pdf',
)

// Calibrated to the template's existing layout. Y is in PDF points
// from the bottom of the page (A4 landscape ≈ 842 × 595).
//   ~y=380  "HAS BEEN AWARDED TO"
//   ~y=295  "for successfully completing"
//   ~y=218  "and has fulfilled all requirements necessary"
// Name sits in the gap above 295; course/module title in the gap
// below it, centred between the two labels.
const NAME_CENTER_Y = 338
const NAME_FONT_SIZE = 36
const COURSE_CENTER_Y = 252
const COURSE_FONT_SIZE = 22
const COURSE_MAX_WIDTH = 600
const COURSE_MAX_LINES = 2
const CERT_ID_X = 36
const CERT_ID_Y = 18
const CERT_ID_FONT_SIZE = 8

// Recipient name + module title use the tenant's primaryColor (see
// hexToRgb below). Cert ID stays muted white so it doesn't fight
// with the design. Underlying template PDF still ships Kondense's
// artwork — swapping the template art per tenant is a future
// follow-up (needs a settings UI to upload a custom template).
const MUTED_WHITE = rgb(0.78, 0.78, 0.82)

/** Six-digit hex to pdf-lib `rgb(0..1, 0..1, 0..1)`. Falls back to
 *  a mid-grey if the string is malformed rather than throwing —
 *  branding is decorative and a bad value shouldn't block delivery. */
function hexToRgb(hex: string): ReturnType<typeof rgb> {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return rgb(0.5, 0.5, 0.5)
  const n = parseInt(match[1], 16)
  return rgb(
    ((n >> 16) & 0xff) / 255,
    ((n >> 8) & 0xff) / 255,
    (n & 0xff) / 255,
  )
}

// Random base32 — Crockford alphabet, no I/L/O/U so support reads
// over the phone don't get mistakes. 8 chars gives ~10^12 space,
// which combined with the unique constraint + retry is plenty.
const SHORT_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const SHORT_CODE_LENGTH = 8
const SHORT_CODE_MAX_ATTEMPTS = 5

interface RenderContext {
  memberName: string
  moduleTitle: string
  shortCode: string
}

export interface CertificateListItem {
  id: string
  shortCode: string
  courseTitle: string
  moduleTitle: string
  issuedAt: Date
}

export interface CertificateDownloadResult {
  ok: true
  url: string
  filename: string
}

export interface CertificateDownloadError {
  ok: false
  error: string
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Called from the lesson-progress hook after every successful
 * "mark complete". Checks whether the lesson's module is now fully
 * complete AND the course allows certificates, and writes an issuance
 * row if so. The (user, module) unique constraint makes duplicate
 * calls a no-op, so the hook can fire on every completion without
 * extra coordination.
 */
export async function issueModuleCertificateIfEligible(
  userId: string,
  lessonId: string,
): Promise<{ issued: boolean; issuanceId?: string }> {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, deletedAt: null },
    select: {
      chapter: {
        select: {
          moduleId: true,
          course: { select: { id: true, certificateEnabled: true } },
        },
      },
    },
  })

  const moduleId = lesson?.chapter.moduleId
  const course = lesson?.chapter.course
  if (!moduleId || !course || !course.certificateEnabled) {
    return { issued: false }
  }

  const eligible = await isModuleFullyComplete(userId, moduleId)
  if (!eligible) return { issued: false }

  return ensureIssuance(userId, moduleId, course.id)
}

/**
 * Powers /certificates. Runs a cheap backfill sweep so members who
 * completed modules before this feature shipped (or before
 * certificateEnabled was flipped on) still see a certificate the
 * moment they open the tab.
 */
export async function listUserCertificates(
  userId: string,
): Promise<CertificateListItem[]> {
  await backfillEligibleIssuances(userId)

  const rows = await prisma.certificateIssuance.findMany({
    // Revoked rows disappear from the member's view entirely.
    where: { userId, revokedAt: null },
    orderBy: { issuedAt: 'desc' },
    select: {
      id: true,
      shortCode: true,
      issuedAt: true,
      module: { select: { title: true } },
      course: { select: { title: true } },
    },
  })

  return rows.map((r) => ({
    id: r.id,
    shortCode: r.shortCode,
    courseTitle: r.course.title,
    moduleTitle: r.module.title,
    issuedAt: r.issuedAt,
  }))
}

/**
 * Fetch the raw PDF bytes for an issuance. Used by admin flows that
 * need the file inline (email attachment). Renders + uploads on first
 * call, otherwise pulls the cached copy from Storage.
 *
 * NOT authz-gated — callers must check permissions before invoking.
 */
export async function getCertificatePdfBytes(
  issuanceId: string,
): Promise<Uint8Array | null> {
  const issuance = await prisma.certificateIssuance.findUnique({
    where: { id: issuanceId },
    select: {
      id: true,
      shortCode: true,
      user: { select: { name: true, email: true } },
      module: { select: { title: true } },
    },
  })
  if (!issuance) return null

  const supabase = createAdminClient()
  const certPath = await withTenantPrefix(`${issuance.id}.pdf`)

  const { data: existing } = await supabase.storage
    .from(CERTIFICATE_BUCKET)
    .list('', { search: certPath, limit: 1 })
  const alreadyGenerated = existing?.some((f) => f.name === certPath)

  if (alreadyGenerated) {
    const { data, error } = await supabase.storage
      .from(CERTIFICATE_BUCKET)
      .download(certPath)
    if (error || !data) {
      console.error('Certificate download from storage failed:', error)
      return null
    }
    return new Uint8Array(await data.arrayBuffer())
  }

  const memberName =
    issuance.user.name?.trim() ||
    issuance.user.email.split('@')[0] ||
    'Member'
  const bytes = await renderCertificatePdf({
    memberName,
    moduleTitle: issuance.module.title,
    shortCode: issuance.shortCode,
  })
  const { error: uploadErr } = await supabase.storage
    .from(CERTIFICATE_BUCKET)
    .upload(certPath, bytes, {
      contentType: 'application/pdf',
      upsert: true,
    })
  if (uploadErr) console.error('Certificate upload failed:', uploadErr)
  return bytes
}

/**
 * Authz + signed-URL minting for one certificate. Generates and
 * uploads the PDF the first time it's requested.
 */
export async function getCertificateDownload(
  userId: string,
  issuanceId: string,
): Promise<CertificateDownloadResult | CertificateDownloadError> {
  const issuance = await prisma.certificateIssuance.findFirst({
    // Revoked rows are inaccessible to the owner.
    where: { id: issuanceId, userId, revokedAt: null },
    select: {
      id: true,
      shortCode: true,
      user: { select: { name: true, email: true } },
      module: { select: { title: true } },
      course: { select: { title: true } },
    },
  })
  if (!issuance) return { ok: false, error: 'Certificate not found' }

  const memberName =
    issuance.user.name?.trim() ||
    issuance.user.email.split('@')[0] ||
    'Member'

  return ensureAndSignPdf({
    issuanceId: issuance.id,
    memberName,
    moduleTitle: issuance.module.title,
    shortCode: issuance.shortCode,
  })
}

// ============================================================
// INTERNALS
// ============================================================

async function isModuleFullyComplete(
  userId: string,
  moduleId: string,
): Promise<boolean> {
  const [total, done] = await Promise.all([
    prisma.lesson.count({
      where: { chapter: { moduleId }, deletedAt: null },
    }),
    prisma.lessonProgress.count({
      where: {
        userId,
        completed: true,
        lesson: { chapter: { moduleId }, deletedAt: null },
      },
    }),
  ])
  return total > 0 && done >= total
}

async function ensureIssuance(
  userId: string,
  moduleId: string,
  courseId: string,
): Promise<{ issued: boolean; issuanceId: string }> {
  // Fast path: someone already has the row.
  const existing = await prisma.certificateIssuance.findUnique({
    where: { userId_moduleId: { userId, moduleId } },
    select: { id: true },
  })
  if (existing) return { issued: false, issuanceId: existing.id }

  // Retry on the rare short-code collision; (user_id, module_id)
  // unique handles the racing-completion case.
  for (let attempt = 0; attempt < SHORT_CODE_MAX_ATTEMPTS; attempt++) {
    try {
      const created = await prisma.certificateIssuance.create({
        data: {
          userId,
          moduleId,
          courseId,
          shortCode: generateShortCode(),
        },
        select: { id: true },
      })
      return { issued: true, issuanceId: created.id }
    } catch (err) {
      if (isUniqueViolation(err, 'short_code')) continue
      if (isUniqueViolation(err, 'user_id') || isRacedIssuance(err)) {
        const row = await prisma.certificateIssuance.findUnique({
          where: { userId_moduleId: { userId, moduleId } },
          select: { id: true },
        })
        if (row) return { issued: false, issuanceId: row.id }
      }
      throw err
    }
  }
  throw new Error('Could not allocate certificate short code')
}

/**
 * One-shot sweep: for every module the member has fully completed in
 * a certificateEnabled course, ensure an issuance exists. Cheap
 * because we only fan out across modules tied to the member's
 * enrollments.
 */
async function backfillEligibleIssuances(userId: string): Promise<void> {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId, course: { certificateEnabled: true, deletedAt: null } },
    select: {
      courseId: true,
      course: {
        select: {
          modules: { select: { id: true } },
        },
      },
    },
  })

  for (const e of enrollments) {
    for (const m of e.course.modules) {
      if (!(await isModuleFullyComplete(userId, m.id))) continue
      await ensureIssuance(userId, m.id, e.courseId)
    }
  }
}

async function ensureAndSignPdf(
  ctx: RenderContext & { issuanceId: string },
): Promise<CertificateDownloadResult | CertificateDownloadError> {
  const supabase = createAdminClient()
  const certPath = await withTenantPrefix(`${ctx.issuanceId}.pdf`)

  const { data: existing } = await supabase.storage
    .from(CERTIFICATE_BUCKET)
    .list('', { search: certPath, limit: 1 })
  const alreadyGenerated = existing?.some((f) => f.name === certPath)

  if (!alreadyGenerated) {
    const bytes = await renderCertificatePdf(ctx)
    const { error: uploadErr } = await supabase.storage
      .from(CERTIFICATE_BUCKET)
      .upload(certPath, bytes, {
        contentType: 'application/pdf',
        upsert: true,
      })
    if (uploadErr) {
      console.error('Certificate upload failed:', uploadErr)
      return { ok: false, error: 'Could not store generated certificate' }
    }
  }

  const filename = certificateFilename(ctx.moduleTitle)
  const { data: signed, error: signErr } = await supabase.storage
    .from(CERTIFICATE_BUCKET)
    .createSignedUrl(certPath, SIGNED_URL_TTL_SEC, { download: filename })
  if (signErr || !signed) {
    console.error('Certificate signed URL failed:', signErr)
    return { ok: false, error: 'Could not generate download link' }
  }

  return { ok: true, url: signed.signedUrl, filename }
}

async function renderCertificatePdf(
  ctx: RenderContext,
): Promise<Uint8Array> {
  const branding = await getBranding()
  const brandColor = hexToRgb(branding.primaryColor)

  const templateBytes = await readFile(TEMPLATE_PATH)
  const pdf = await PDFDocument.load(templateBytes)
  pdf.setTitle(`${ctx.moduleTitle} — Certificate`)
  pdf.setAuthor(branding.legalCompany)
  pdf.setCreator(branding.productName)

  const page = pdf.getPage(0)
  const { width: pageWidth } = page.getSize()

  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const helv = await pdf.embedFont(StandardFonts.Helvetica)

  drawCentredText(page, ctx.memberName, {
    cx: pageWidth / 2,
    y: NAME_CENTER_Y,
    font: helvBold,
    size: NAME_FONT_SIZE,
    color: brandColor,
  })

  const titleLines = wrapText(ctx.moduleTitle, {
    font: helvBold,
    size: COURSE_FONT_SIZE,
    maxWidth: COURSE_MAX_WIDTH,
    maxLines: COURSE_MAX_LINES,
  })
  const lineGap = COURSE_FONT_SIZE * 1.2
  const titleTopY =
    COURSE_CENTER_Y + ((titleLines.length - 1) * lineGap) / 2
  titleLines.forEach((line, i) => {
    drawCentredText(page, line, {
      cx: pageWidth / 2,
      y: titleTopY - i * lineGap,
      font: helvBold,
      size: COURSE_FONT_SIZE,
      color: brandColor,
    })
  })

  page.drawText(`CERT # ${ctx.shortCode}`, {
    x: CERT_ID_X,
    y: CERT_ID_Y,
    size: CERT_ID_FONT_SIZE,
    font: helv,
    color: MUTED_WHITE,
  })

  return pdf.save()
}

function certificateFilename(title: string): string {
  const safe = title.replace(/[^a-zA-Z0-9 -]+/g, '').trim() || 'Certificate'
  return `${safe} — Certificate.pdf`
}

function generateShortCode(): string {
  let out = ''
  for (let i = 0; i < SHORT_CODE_LENGTH; i++) {
    out += SHORT_CODE_ALPHABET[
      Math.floor(Math.random() * SHORT_CODE_ALPHABET.length)
    ]
  }
  return out
}

function isUniqueViolation(err: unknown, fieldHint: string): boolean {
  if (!err || typeof err !== 'object') return false
  const code = (err as { code?: string }).code
  const meta = (err as { meta?: { target?: string | string[] } }).meta
  if (code !== 'P2002') return false
  const target = Array.isArray(meta?.target) ? meta!.target.join(',') : meta?.target
  return target?.includes(fieldHint) ?? false
}

function isRacedIssuance(err: unknown): boolean {
  return (
    !!err &&
    typeof err === 'object' &&
    (err as { code?: string }).code === 'P2002'
  )
}

interface CentredTextOptions {
  cx: number
  y: number
  font: Awaited<ReturnType<PDFDocument['embedFont']>>
  size: number
  color: ReturnType<typeof rgb>
}

function drawCentredText(
  page: ReturnType<PDFDocument['getPage']>,
  text: string,
  opts: CentredTextOptions,
): void {
  const w = opts.font.widthOfTextAtSize(text, opts.size)
  page.drawText(text, {
    x: opts.cx - w / 2,
    y: opts.y - opts.size / 2,
    size: opts.size,
    font: opts.font,
    color: opts.color,
  })
}

interface WrapOptions {
  font: Awaited<ReturnType<PDFDocument['embedFont']>>
  size: number
  maxWidth: number
  maxLines: number
}

/**
 * Greedy word-wrap using the embedded font's metrics. Last line is
 * hard-truncated with an ellipsis if the text overflows maxLines so
 * the stamp layout stays predictable.
 */
function wrapText(text: string, opts: WrapOptions): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (opts.font.widthOfTextAtSize(candidate, opts.size) <= opts.maxWidth) {
      current = candidate
    } else {
      if (current) lines.push(current)
      current = word
      if (lines.length >= opts.maxLines) break
    }
  }
  if (current && lines.length < opts.maxLines) lines.push(current)

  if (lines.length > opts.maxLines) {
    const truncated = lines.slice(0, opts.maxLines)
    let last = truncated[opts.maxLines - 1]!
    while (
      last.length > 1 &&
      opts.font.widthOfTextAtSize(last + '…', opts.size) > opts.maxWidth
    ) {
      last = last.slice(0, -1)
    }
    truncated[opts.maxLines - 1] = last + '…'
    return truncated
  }
  return lines
}

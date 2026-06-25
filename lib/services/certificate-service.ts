// Course completion certificate (Ticket 6.2).
//
// Generates a Kondense-branded PDF from scratch when a completed
// member clicks Download. No template upload — we own the design here
// so it stays consistent across courses and we don't have to tune
// stamp coordinates. Layout is inspired by DataCamp's Statement of
// Accomplishment (two-column, dark brand panel on the left, content
// on the right).
//
// First-request flow:
//   1. Authz: enrollment must belong to user, have completedAt, and
//      course.certificateEnabled must be true.
//   2. Pull course duration (sum of lesson durationSeconds).
//   3. Generate the PDF with pdf-lib using standard fonts.
//   4. Cache at course-certificates/<enrollmentId>.pdf.
//   5. Return a short-lived signed download URL.
//
// Subsequent requests skip step 3 and just re-sign the cached PDF.
// Cert ID is the enrollment UUID — already unique, no counter needed.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'

const CERTIFICATE_BUCKET = 'course-certificates'
const SIGNED_URL_TTL_SEC = 60 * 10 // 10 min — plenty for click-to-download

// Hardcoded signer; ticketed in 6.2 as a v1 simplification.
const SIGNER_NAME = 'Keanu Vasquez'
const SIGNER_TITLE = 'Founder'

// Brand palette. Kondense red on the left panel, cream content area,
// near-black for body, muted slate for eyebrow labels.
const KONDENSE_RED = rgb(0.819, 0.102, 0.102) // #d11a1a
const CREAM = rgb(0.984, 0.976, 0.961)
const NEAR_BLACK = rgb(0.039, 0.039, 0.043)
const MUTED = rgb(0.42, 0.42, 0.45)
const RULE_GREY = rgb(0.78, 0.78, 0.8)

// A4 landscape in PDF points (72pt = 1in). Used as a fixed canvas
// so layout positions stay deterministic across courses.
const PAGE_WIDTH = 842
const PAGE_HEIGHT = 595
const LEFT_PANEL_WIDTH = 200
const CONTENT_LEFT = LEFT_PANEL_WIDTH + 56
const CONTENT_RIGHT = PAGE_WIDTH - 56

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
})

interface CertificateContext {
  enrollmentId: string
  memberName: string
  courseTitle: string
  completedAt: Date
  /** Total content duration across READY lessons, in seconds. */
  totalSeconds: number
}

export interface CertificateResult {
  ok: true
  url: string
  filename: string
}

export interface CertificateError {
  ok: false
  error: string
}

/**
 * Look up an enrollment + its course, gate on completion + cert
 * enabled, then return a signed download URL for the cert. Generates
 * the PDF on the first request and caches it in storage.
 */
export async function generateOrFetchCertificate(
  userId: string,
  enrollmentId: string,
): Promise<CertificateResult | CertificateError> {
  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, userId },
    select: {
      id: true,
      completedAt: true,
      course: {
        select: {
          id: true,
          title: true,
          certificateEnabled: true,
          chapters: {
            where: { deletedAt: null },
            select: {
              lessons: {
                where: { deletedAt: null, status: 'READY' },
                select: { durationSeconds: true },
              },
            },
          },
        },
      },
      user: {
        select: { name: true, email: true },
      },
    },
  })
  if (!enrollment) {
    return { ok: false, error: 'Enrollment not found' }
  }
  if (!enrollment.completedAt) {
    return { ok: false, error: 'Course not yet completed' }
  }
  if (!enrollment.course.certificateEnabled) {
    return { ok: false, error: 'Certificates are not enabled for this course' }
  }

  const memberName =
    enrollment.user.name?.trim() || enrollment.user.email.split('@')[0] || 'Member'
  const totalSeconds = enrollment.course.chapters.reduce(
    (sum, ch) =>
      sum + ch.lessons.reduce((s, l) => s + (l.durationSeconds ?? 0), 0),
    0,
  )

  return ensureAndSignCertificate({
    enrollmentId: enrollment.id,
    memberName,
    courseTitle: enrollment.course.title,
    completedAt: enrollment.completedAt,
    totalSeconds,
  })
}

async function ensureAndSignCertificate(
  ctx: CertificateContext,
): Promise<CertificateResult | CertificateError> {
  const supabase = createAdminClient()
  const certPath = `${ctx.enrollmentId}.pdf`

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

  const { data: signed, error: signErr } = await supabase.storage
    .from(CERTIFICATE_BUCKET)
    .createSignedUrl(certPath, SIGNED_URL_TTL_SEC, {
      download: certificateFilename(ctx),
    })
  if (signErr || !signed) {
    console.error('Certificate signed URL failed:', signErr)
    return { ok: false, error: 'Could not generate download link' }
  }

  return {
    ok: true,
    url: signed.signedUrl,
    filename: certificateFilename(ctx),
  }
}

async function renderCertificatePdf(ctx: CertificateContext): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`${ctx.courseTitle} — Certificate`)
  pdf.setAuthor('Kondense')
  pdf.setCreator('Kondense')

  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const helv = await pdf.embedFont(StandardFonts.Helvetica)
  const mono = await pdf.embedFont(StandardFonts.Courier)

  // ── Background ────────────────────────────────────────────────
  // Cream content area (full page), then a Kondense-red panel on the
  // left. Layering this way means any subtle accents (gold border,
  // future watermark) can sit on top of the cream without leaking
  // into the brand panel.
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    color: CREAM,
  })
  page.drawRectangle({
    x: 0,
    y: 0,
    width: LEFT_PANEL_WIDTH,
    height: PAGE_HEIGHT,
    color: KONDENSE_RED,
  })

  // ── Left panel: Kondense wordmark ─────────────────────────────
  // No image asset yet — render the wordmark as a centred big bold
  // word. Easy to swap for an embedded logo later (embedPng / embedJpg).
  drawCentredIn(
    page,
    'Kondense',
    {
      cx: LEFT_PANEL_WIDTH / 2,
      y: PAGE_HEIGHT / 2,
      font: helvBold,
      size: 32,
      color: rgb(1, 1, 1),
    },
  )

  // ── Right panel content ───────────────────────────────────────
  // Walk top → bottom, tracking the running Y cursor so future
  // adjustments only need to retune the deltas.
  let y = PAGE_HEIGHT - 70

  // Heading
  drawText(page, 'CERTIFICATE OF COMPLETION', {
    x: CONTENT_LEFT,
    y,
    font: helvBold,
    size: 26,
    color: NEAR_BLACK,
  })
  y -= 22

  // Cert ID
  drawText(page, `#${ctx.enrollmentId}`, {
    x: CONTENT_LEFT,
    y,
    font: mono,
    size: 9,
    color: MUTED,
  })
  y -= 50

  // Awarded-to eyebrow + name
  drawText(page, 'HAS BEEN AWARDED TO', {
    x: CONTENT_LEFT,
    y,
    font: helvBold,
    size: 9,
    color: KONDENSE_RED,
    spacing: 2,
  })
  y -= 28
  drawText(page, ctx.memberName, {
    x: CONTENT_LEFT,
    y,
    font: helvBold,
    size: 28,
    color: NEAR_BLACK,
  })
  y -= 44

  // Course-completion eyebrow + course title
  drawText(page, 'FOR SUCCESSFULLY COMPLETING', {
    x: CONTENT_LEFT,
    y,
    font: helvBold,
    size: 9,
    color: KONDENSE_RED,
    spacing: 2,
  })
  y -= 26
  // Course title can wrap to a second line if it's long. Wrap at the
  // content right edge; clamp to 2 lines so the rest of the layout
  // doesn't shift.
  const titleLines = wrapText(ctx.courseTitle, {
    font: helvBold,
    size: 22,
    maxWidth: CONTENT_RIGHT - CONTENT_LEFT,
    maxLines: 2,
  })
  for (const line of titleLines) {
    drawText(page, line, {
      x: CONTENT_LEFT,
      y,
      font: helvBold,
      size: 22,
      color: NEAR_BLACK,
    })
    y -= 28
  }
  y -= 10

  // Length + completion date sit side-by-side
  const colTwoX = CONTENT_LEFT + 220

  drawText(page, 'LENGTH', {
    x: CONTENT_LEFT,
    y,
    font: helvBold,
    size: 9,
    color: KONDENSE_RED,
    spacing: 2,
  })
  drawText(page, 'COMPLETED ON', {
    x: colTwoX,
    y,
    font: helvBold,
    size: 9,
    color: KONDENSE_RED,
    spacing: 2,
  })
  y -= 20
  drawText(page, formatDuration(ctx.totalSeconds), {
    x: CONTENT_LEFT,
    y,
    font: helvBold,
    size: 16,
    color: NEAR_BLACK,
  })
  drawText(page, DATE_FMT.format(ctx.completedAt).toUpperCase(), {
    x: colTwoX,
    y,
    font: helvBold,
    size: 16,
    color: NEAR_BLACK,
  })

  // ── Bottom-right signer block ────────────────────────────────
  // Rule + signer name + title. Keeps the layout grounded without
  // needing an actual signature image asset.
  const signerRight = CONTENT_RIGHT
  const signerLeft = signerRight - 180
  const signerY = 70

  page.drawLine({
    start: { x: signerLeft, y: signerY + 22 },
    end: { x: signerRight, y: signerY + 22 },
    thickness: 0.5,
    color: RULE_GREY,
  })
  drawText(page, SIGNER_NAME, {
    x: signerLeft,
    y: signerY + 8,
    font: helvBold,
    size: 11,
    color: NEAR_BLACK,
  })
  drawText(page, SIGNER_TITLE.toUpperCase(), {
    x: signerLeft,
    y: signerY - 6,
    font: helv,
    size: 8,
    color: MUTED,
    spacing: 1.5,
  })

  return pdf.save()
}

interface DrawTextOptions {
  x: number
  y: number
  font: Awaited<ReturnType<PDFDocument['embedFont']>>
  size: number
  color: ReturnType<typeof rgb>
  spacing?: number // letter-spacing for eyebrow labels
}

function drawText(
  page: ReturnType<PDFDocument['addPage']>,
  text: string,
  opts: DrawTextOptions,
): void {
  page.drawText(text, {
    x: opts.x,
    y: opts.y,
    size: opts.size,
    font: opts.font,
    color: opts.color,
    ...(opts.spacing != null ? { characterSpacing: opts.spacing } : {}),
  })
}

interface CentredOptions {
  cx: number
  y: number
  font: Awaited<ReturnType<PDFDocument['embedFont']>>
  size: number
  color: ReturnType<typeof rgb>
}

function drawCentredIn(
  page: ReturnType<PDFDocument['addPage']>,
  text: string,
  opts: CentredOptions,
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
 * Greedy word-wrap that respects the embedded font's metrics. Last
 * line is hard-truncated with an ellipsis if the text overflows
 * maxLines so the layout stays predictable.
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
    // Truncate + ellipsis on the last allowed line.
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

/**
 * Human-readable course length. Mirrors the formatTotalDuration helper
 * on the completion page so the cert and on-screen recap agree.
 *   3600 → "1 HOUR", 7200 → "2 HOURS", 1800 → "30 MIN"
 */
function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '—'
  const totalMin = Math.round(seconds / 60)
  if (totalMin < 60) return `${totalMin} MIN`
  const hr = Math.floor(totalMin / 60)
  const min = totalMin % 60
  if (min === 0) return `${hr} HOUR${hr === 1 ? '' : 'S'}`
  return `${hr} HR ${min} MIN`
}

function certificateFilename(ctx: CertificateContext): string {
  const safeTitle =
    ctx.courseTitle.replace(/[^a-zA-Z0-9 ]+/g, '').trim() || 'Course'
  return `${safeTitle} — Certificate.pdf`
}

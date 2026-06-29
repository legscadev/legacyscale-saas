// Course completion certificate.
//
// Uses Kondense's design-team PDF template (public/cert-template.pdf)
// as the visual base and stamps three pieces of dynamic content on
// top of the empty layout regions:
//
//   1. RECIPIENT NAME — between "HAS BEEN AWARDED TO" and
//      "for successfully completing".
//   2. COURSE TITLE — between "for successfully completing" and
//      the "next module of the program" line.
//   3. CERT ID — small, bottom-left corner, for support lookups.
//
// First-request flow:
//   1. Authz: enrollment belongs to user, has completedAt, and
//      course.certificateEnabled is true.
//   2. Render the stamped PDF (template + overlay).
//   3. Cache at course-certificates/<enrollmentId>.pdf.
//   4. Return a short-lived signed download URL.
//
// Subsequent requests skip render and just re-sign the cached PDF.
// Cert ID = enrollment UUID (already unique, no counter needed).

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'

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
// Visual reference inside the template:
//   ~y=380  "HAS BEEN AWARDED TO"
//   ~y=295  "for successfully completing"
//   ~y=218  "and has fulfilled all requirements necessary"
// Name sits in the gap above 295; course title in the gap below it.
const NAME_CENTER_Y = 338
const NAME_FONT_SIZE = 36
const COURSE_CENTER_Y = 257
const COURSE_FONT_SIZE = 22
const COURSE_MAX_WIDTH = 600
const COURSE_MAX_LINES = 2
const CERT_ID_X = 36
const CERT_ID_Y = 18
const CERT_ID_FONT_SIZE = 8

// Color tokens. Template background is dark with red accents, so
// overlays use white for the main fields and a muted gray for the
// quiet cert ID footer.
const WHITE = rgb(1, 1, 1)
const MUTED_WHITE = rgb(0.78, 0.78, 0.82)

interface CertificateContext {
  enrollmentId: string
  memberName: string
  courseTitle: string
  completedAt: Date
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
    return {
      ok: false,
      error: 'Certificates are not enabled for this course',
    }
  }

  const memberName =
    enrollment.user.name?.trim() ||
    enrollment.user.email.split('@')[0] ||
    'Member'

  return ensureAndSignCertificate({
    enrollmentId: enrollment.id,
    memberName,
    courseTitle: enrollment.course.title,
    completedAt: enrollment.completedAt,
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

async function renderCertificatePdf(
  ctx: CertificateContext,
): Promise<Uint8Array> {
  const templateBytes = await readFile(TEMPLATE_PATH)
  const pdf = await PDFDocument.load(templateBytes)
  pdf.setTitle(`${ctx.courseTitle} — Certificate`)
  pdf.setAuthor('Kondense')
  pdf.setCreator('Kondense')

  const page = pdf.getPage(0)
  const { width: pageWidth } = page.getSize()

  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const helv = await pdf.embedFont(StandardFonts.Helvetica)

  // 1. Recipient name — large, centered, between "HAS BEEN AWARDED TO"
  //    and "for successfully completing".
  drawCentredText(page, ctx.memberName, {
    cx: pageWidth / 2,
    y: NAME_CENTER_Y,
    font: helvBold,
    size: NAME_FONT_SIZE,
    color: WHITE,
  })

  // 2. Course title — medium, centered, wraps to 2 lines if long.
  const titleLines = wrapText(ctx.courseTitle, {
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
      color: WHITE,
    })
  })

  // 3. Cert ID — small, bottom-left corner. Last 8 chars of the
  //    enrollment UUID is plenty for a support lookup; full ID
  //    stays unique by virtue of how we cache the file.
  const shortId =
    ctx.enrollmentId.split('-').pop()?.slice(-8) ?? ctx.enrollmentId
  page.drawText(`CERT # ${shortId.toUpperCase()}`, {
    x: CERT_ID_X,
    y: CERT_ID_Y,
    size: CERT_ID_FONT_SIZE,
    font: helv,
    color: MUTED_WHITE,
  })

  return pdf.save()
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

function certificateFilename(ctx: CertificateContext): string {
  const safeTitle =
    ctx.courseTitle.replace(/[^a-zA-Z0-9 ]+/g, '').trim() || 'Course'
  return `${safeTitle} — Certificate.pdf`
}

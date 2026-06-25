// Course completion certificate generation (Ticket 6.2).
//
// The admin uploads a PDF template (with blank space for the student
// name) per-course. When a completed member requests their cert, we:
//   1. Fetch the template from Supabase Storage
//   2. Stamp three text overlays (name, completion date, cert ID)
//   3. Cache the generated PDF at `<enrollmentId>.pdf`
//   4. Return a signed download URL
//
// Generation is lazy + cached: the first download triggers the stamp;
// subsequent downloads just return the cached file. Cert ID is the
// enrollment UUID — already unique, no separate counter needed.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'

const CERTIFICATE_BUCKET = 'course-certificates'
const SIGNED_URL_TTL_SEC = 60 * 10 // 10 minutes — plenty for a click-to-download

const CERT_DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

// Stamp positions (as fractions of page width/height, 0–1). Designed
// for a template where the student name sits in the centre of the
// page. Tweak these if your template's blank fields move.
const NAME_Y_FRACTION = 0.55 // ~55% from bottom = vertically slightly above centre
const DATE_Y_FRACTION = 0.38
const CERT_ID_Y_FRACTION = 0.12

const NAME_FONT_SIZE = 36
const DATE_FONT_SIZE = 14
const CERT_ID_FONT_SIZE = 9

interface CertificateContext {
  enrollmentId: string
  memberName: string
  courseTitle: string
  completedAt: Date
  templatePath: string
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
 * Look up an enrollment + its course, gate on completion, then return
 * a signed download URL for the cert. Generates the PDF on the first
 * request and caches it in storage.
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
          certificateTemplateUrl: true,
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
  if (!enrollment.course.certificateTemplateUrl) {
    return { ok: false, error: 'No certificate template configured for this course' }
  }

  const templatePath = extractTemplatePath(enrollment.course.certificateTemplateUrl)
  if (!templatePath) {
    return { ok: false, error: 'Certificate template URL is malformed' }
  }

  const memberName =
    enrollment.user.name?.trim() || enrollment.user.email.split('@')[0] || 'Member'

  return ensureAndSignCertificate({
    enrollmentId: enrollment.id,
    memberName,
    courseTitle: enrollment.course.title,
    completedAt: enrollment.completedAt,
    templatePath,
  })
}

async function ensureAndSignCertificate(
  ctx: CertificateContext,
): Promise<CertificateResult | CertificateError> {
  const supabase = createAdminClient()
  const certPath = `${ctx.enrollmentId}.pdf`

  // Check whether the cert already exists by listing the bucket for
  // this exact filename. Cheaper than downloading + 404 handling.
  const { data: existing } = await supabase.storage
    .from(CERTIFICATE_BUCKET)
    .list('', { search: certPath, limit: 1 })

  const alreadyGenerated = existing?.some((f) => f.name === certPath)

  if (!alreadyGenerated) {
    const stamped = await stampCertificate(ctx, supabase)
    if (!stamped.ok) return stamped

    const { error: uploadErr } = await supabase.storage
      .from(CERTIFICATE_BUCKET)
      .upload(certPath, stamped.bytes, {
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

interface StampSuccess {
  ok: true
  bytes: Uint8Array
}

async function stampCertificate(
  ctx: CertificateContext,
  supabase: ReturnType<typeof createAdminClient>,
): Promise<StampSuccess | CertificateError> {
  // Pull the template bytes from the admin client so we can read
  // even if the bucket is private.
  const { data: templateBlob, error: dlErr } = await supabase.storage
    .from(CERTIFICATE_BUCKET)
    .download(ctx.templatePath)
  if (dlErr || !templateBlob) {
    console.error('Certificate template download failed:', dlErr)
    return { ok: false, error: 'Certificate template is unavailable' }
  }

  const templateBytes = new Uint8Array(await templateBlob.arrayBuffer())
  const pdf = await PDFDocument.load(templateBytes)

  // Stamp on the first page only — template is expected to be a
  // single-page certificate.
  const page = pdf.getPages()[0]
  if (!page) {
    return { ok: false, error: 'Certificate template has no pages' }
  }

  const font = await pdf.embedFont(StandardFonts.HelveticaBold)
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica)
  const monoFont = await pdf.embedFont(StandardFonts.Courier)

  const { width, height } = page.getSize()
  const black = rgb(0.1, 0.1, 0.1)
  const muted = rgb(0.35, 0.35, 0.35)

  // Name — large, bold, horizontally centred.
  drawCentered(page, ctx.memberName, {
    y: height * NAME_Y_FRACTION,
    font,
    size: NAME_FONT_SIZE,
    color: black,
    pageWidth: width,
  })

  // Date — smaller, mid font weight.
  drawCentered(page, CERT_DATE_FMT.format(ctx.completedAt), {
    y: height * DATE_Y_FRACTION,
    font: regularFont,
    size: DATE_FONT_SIZE,
    color: muted,
    pageWidth: width,
  })

  // Cert ID footer — tiny mono, for verification reference.
  drawCentered(page, `Certificate ID: ${ctx.enrollmentId}`, {
    y: height * CERT_ID_Y_FRACTION,
    font: monoFont,
    size: CERT_ID_FONT_SIZE,
    color: muted,
    pageWidth: width,
  })

  const bytes = await pdf.save()
  return { ok: true, bytes }
}

interface DrawCenteredOptions {
  y: number
  font: Awaited<ReturnType<PDFDocument['embedFont']>>
  size: number
  color: ReturnType<typeof rgb>
  pageWidth: number
}

function drawCentered(
  page: ReturnType<PDFDocument['getPages']>[number],
  text: string,
  opts: DrawCenteredOptions,
) {
  const textWidth = opts.font.widthOfTextAtSize(text, opts.size)
  const x = (opts.pageWidth - textWidth) / 2
  page.drawText(text, {
    x,
    y: opts.y,
    size: opts.size,
    font: opts.font,
    color: opts.color,
  })
}

/**
 * Parse the storage path from a Supabase public URL. The URL pattern is
 *   https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
 * Returns null if the URL doesn't belong to our certificates bucket.
 */
function extractTemplatePath(url: string): string | null {
  const m = url.match(/\/storage\/v1\/object\/public\/course-certificates\/(.+)$/)
  return m ? decodeURIComponent(m[1]) : null
}

function certificateFilename(ctx: CertificateContext): string {
  const safeTitle = ctx.courseTitle.replace(/[^a-zA-Z0-9 ]+/g, '').trim() || 'Course'
  return `${safeTitle} — Certificate.pdf`
}

import { type ReactElement } from 'react'
import { Resend } from 'resend'
import { AnnouncementEmail } from '@/emails/announcement'
import { CourseCompleteEmail } from '@/emails/course-complete'
import { PasswordResetEmail } from '@/emails/password-reset'
import { WelcomeEmail } from '@/emails/welcome'

// Lazy singleton — only throws on first use, not at import time, so
// `next build` and code paths that don't email don't crash when the key
// isn't set (e.g. CI without env vars).
let _resend: Resend | null = null

function getResend(): Resend {
  if (_resend) return _resend
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('Missing RESEND_API_KEY')
  }
  _resend = new Resend(apiKey)
  return _resend
}

const FROM_NAME = 'Kondense'

type EmailPurpose = 'welcome' | 'security' | 'notifications' | 'billing'

function getFromAddress(purpose: EmailPurpose): string {
  // Per-mailstream from-addresses so reputation issues stay isolated
  // (e.g. a flagged notification doesn't poison the welcome stream).
  // Falls back to RESEND_FROM_EMAIL, then Resend's sandbox sender.
  const purposeEnv = {
    welcome: process.env.RESEND_FROM_WELCOME,
    security: process.env.RESEND_FROM_SECURITY,
    notifications: process.env.RESEND_FROM_NOTIFICATIONS,
    billing: process.env.RESEND_FROM_BILLING,
  }[purpose]
  const email =
    purposeEnv ?? process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
  return `${FROM_NAME} <${email}>`
}

interface EmailAttachment {
  /** Filename shown in the recipient's mail client. */
  filename: string
  /** Raw bytes of the attachment. Resend base64-encodes internally. */
  content: Buffer
  /** e.g. 'application/pdf'. Optional — Resend infers from extension. */
  contentType?: string
}

interface SendEmailOptions {
  to: string | string[]
  subject: string
  react: ReactElement
  purpose: EmailPurpose
  /** Override default reply-to (RESEND_REPLY_TO env var). */
  replyTo?: string
  /** File attachments. Used by the admin "email cert" flow. */
  attachments?: EmailAttachment[]
}

export async function sendEmail({
  to,
  subject,
  react,
  purpose,
  replyTo,
  attachments,
}: SendEmailOptions): Promise<{ id: string | undefined }> {
  const resend = getResend()
  const { data, error } = await resend.emails.send({
    from: getFromAddress(purpose),
    to: Array.isArray(to) ? to : [to],
    subject,
    react,
    replyTo: replyTo ?? process.env.RESEND_REPLY_TO,
    attachments: attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  })

  if (error) {
    throw new Error(`Resend send failed: ${error.message}`)
  }

  return { id: data?.id }
}

// ───────── typed helpers per template ─────────

interface WelcomeEmailOptions {
  /** CTA target. For invites, this is the onboarding link; for
   *  returning members, the dashboard. */
  ctaUrl: string
  variant?: 'invite' | 'dashboard'
}

export async function sendWelcomeEmail(
  to: string,
  name: string,
  options: WelcomeEmailOptions
) {
  const isInvite = options.variant === 'invite'
  return sendEmail({
    to,
    purpose: 'welcome',
    subject: isInvite
      ? "Welcome to Kondense — Let's Get Started"
      : 'Welcome to Kondense!',
    react: WelcomeEmail({
      name,
      ctaUrl: options.ctaUrl,
      variant: options.variant,
    }),
  })
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetUrl: string
) {
  return sendEmail({
    to,
    purpose: 'security',
    subject: 'Reset Your Password — Kondense',
    react: PasswordResetEmail({ name, resetUrl }),
  })
}

export async function sendAnnouncementEmail(
  to: string[],
  title: string,
  body: string,
  viewUrl: string
) {
  return sendEmail({
    to,
    purpose: 'notifications',
    subject: `New Announcement: ${title}`,
    react: AnnouncementEmail({ title, body, viewUrl }),
  })
}

export async function sendCourseCompleteEmail(
  to: string,
  name: string,
  courseTitle: string,
  completeUrl: string
) {
  return sendEmail({
    to,
    purpose: 'notifications',
    subject: `Congrats — you finished ${courseTitle}`,
    react: CourseCompleteEmail({ name, courseTitle, completeUrl }),
  })
}

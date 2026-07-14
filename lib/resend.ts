import { type ReactElement } from 'react'
import { Resend } from 'resend'
import { AnnouncementEmail } from '@/emails/announcement'
import { CompanyOwnerInviteEmail } from '@/emails/company-owner-invite'
import { CourseCompleteEmail } from '@/emails/course-complete'
import { PasswordResetEmail } from '@/emails/password-reset'
import { WelcomeEmail } from '@/emails/welcome'
import { getBranding } from '@/lib/branding/get-branding'

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

type EmailPurpose = 'welcome' | 'security' | 'notifications' | 'billing'

function getFromAddress(purpose: EmailPurpose, fromName: string): string {
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
  return `${fromName} <${email}>`
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
  fromName,
}: SendEmailOptions & { fromName: string }): Promise<{ id: string | undefined }> {
  const resend = getResend()
  const { data, error } = await resend.emails.send({
    from: getFromAddress(purpose, fromName),
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
  const branding = await getBranding()
  const isInvite = options.variant === 'invite'
  return sendEmail({
    to,
    purpose: 'welcome',
    fromName: branding.fromName,
    subject: isInvite
      ? `Welcome to ${branding.productName} — Let's Get Started`
      : `Welcome to ${branding.productName}!`,
    react: WelcomeEmail({
      name,
      ctaUrl: options.ctaUrl,
      variant: options.variant,
      branding,
    }),
  })
}

interface CompanyOwnerInviteOptions {
  /** Name of the tenant the recipient has been granted OWNER on. */
  companyName: string
  /** Password-set + landing link — /onboarding?token=… */
  ctaUrl: string
}

/**
 * Dedicated invite for the initial OWNER of a freshly-provisioned
 * tenant. Uses the platform (Kondense) brand at send time because the
 * new tenant has no brand set yet — the recipient is being told
 * "you're being handed this tenant on our platform," so the platform
 * identity is the right sender.
 */
export async function sendCompanyOwnerInvite(
  to: string,
  name: string,
  options: CompanyOwnerInviteOptions,
) {
  const branding = await getBranding()
  return sendEmail({
    to,
    purpose: 'welcome',
    fromName: branding.fromName,
    subject: `You're the owner of ${options.companyName} on ${branding.productName}`,
    react: CompanyOwnerInviteEmail({
      name,
      companyName: options.companyName,
      ctaUrl: options.ctaUrl,
      branding,
    }),
  })
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetUrl: string
) {
  const branding = await getBranding()
  return sendEmail({
    to,
    purpose: 'security',
    fromName: branding.fromName,
    subject: `Reset Your Password — ${branding.productName}`,
    react: PasswordResetEmail({ name, resetUrl, branding }),
  })
}

export async function sendAnnouncementEmail(
  to: string[],
  title: string,
  body: string,
  viewUrl: string
) {
  const branding = await getBranding()
  return sendEmail({
    to,
    purpose: 'notifications',
    fromName: branding.fromName,
    subject: `New Announcement: ${title}`,
    react: AnnouncementEmail({ title, body, viewUrl, branding }),
  })
}

export async function sendCourseCompleteEmail(
  to: string,
  name: string,
  courseTitle: string,
  completeUrl: string
) {
  const branding = await getBranding()
  return sendEmail({
    to,
    purpose: 'notifications',
    fromName: branding.fromName,
    subject: `Congrats — you finished ${courseTitle}`,
    react: CourseCompleteEmail({ name, courseTitle, completeUrl, branding }),
  })
}

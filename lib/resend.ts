import { type ReactElement } from 'react'
import { Resend } from 'resend'
import { AnnouncementEmail } from '@/emails/announcement'
import { CompanyOwnerInviteEmail } from '@/emails/company-owner-invite'
import { CourseCompleteEmail } from '@/emails/course-complete'
import { LeadConfirmationEmail } from '@/emails/lead-confirmation'
import { NewLeadEmail, type NewLeadAnswer } from '@/emails/new-lead'
import { OwnerAddedEmail } from '@/emails/owner-added'
import { PasswordResetEmail } from '@/emails/password-reset'
import { WelcomeEmail } from '@/emails/welcome'
import { DEFAULT_BRANDING } from '@/lib/branding/defaults'
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
    subject: `Your ${branding.productName} workspace is ready: ${options.companyName}`,
    react: CompanyOwnerInviteEmail({
      name,
      companyName: options.companyName,
      ctaUrl: options.ctaUrl,
      branding,
    }),
  })
}

interface OwnerAddedNoticeOptions {
  companyName: string
  ctaUrl: string
  isSuperAdmin?: boolean
  wasPromoted?: boolean
}

/**
 * Heads-up email for EXISTING users who got attached as OWNER of a
 * new tenant via /super/create-company. Uses the platform brand,
 * because the point is to tell them Kondense assigned them the
 * tenant — they may not have seen the new tenant's brand yet.
 */
export async function sendOwnerAddedNotice(
  to: string,
  name: string,
  options: OwnerAddedNoticeOptions,
) {
  const branding = await getBranding()
  return sendEmail({
    to,
    purpose: 'welcome',
    fromName: branding.fromName,
    subject: `Your ${branding.productName} workspace is ready: ${options.companyName}`,
    react: OwnerAddedEmail({
      name,
      companyName: options.companyName,
      ctaUrl: options.ctaUrl,
      isSuperAdmin: options.isSuperAdmin,
      wasPromoted: options.wasPromoted,
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

interface NewLeadEmailOptions {
  /** Funnel owner being notified. */
  recipientName: string
  leadName: string
  leadEmail?: string | null
  leadPhone?: string | null
  source?: string | null
  answers?: NewLeadAnswer[]
  /** Deep link into the CRM. */
  ctaUrl: string
}

/** Confirmation email to the LEAD who just applied via a funnel. Sent
 *  from the funnel's program brand (not Kondense) — uses default styling
 *  with the product name + legal entity overridden. Public intake has no
 *  session, so no getBranding(). */
export async function sendLeadConfirmationEmail(
  to: string,
  options: { leadName: string; productName?: string },
) {
  const productName = options.productName ?? 'AI Agents Club'
  const branding = {
    ...DEFAULT_BRANDING,
    productName,
    fromName: productName,
    legalCompany: 'Legacy Scale LLC',
  }
  return sendEmail({
    to,
    purpose: 'notifications',
    fromName: productName,
    subject: `We got your application — ${productName}`,
    react: LeadConfirmationEmail({ leadName: options.leadName, productName, branding }),
  })
}

/** Notify a funnel owner that a new lead landed in their pipeline.
 *  Fired from the public intake (no auth session), so it uses default
 *  branding rather than getBranding() — the latter reads request cookies
 *  that don't exist here, which would just error + fall back anyway. */
export async function sendNewLeadEmail(
  to: string | string[],
  options: NewLeadEmailOptions,
) {
  const branding = DEFAULT_BRANDING
  return sendEmail({
    to,
    purpose: 'notifications',
    fromName: branding.fromName,
    subject: `New lead: ${options.leadName}`,
    react: NewLeadEmail({ ...options, branding }),
  })
}

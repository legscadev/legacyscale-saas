import { type ReactElement } from 'react'
import { Resend } from 'resend'
import { AnnouncementEmail } from '@/emails/announcement'
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

const FROM_NAME = 'Legacy Scale'

function getFromAddress(): string {
  // Sandbox default works without a verified domain but only delivers to
  // the Resend account holder's own email. Swap RESEND_FROM_EMAIL to your
  // verified address once 0.7 + DNS verification is done.
  const email = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
  return `${FROM_NAME} <${email}>`
}

interface SendEmailOptions {
  to: string | string[]
  subject: string
  react: ReactElement
  replyTo?: string
}

export async function sendEmail({
  to,
  subject,
  react,
  replyTo,
}: SendEmailOptions): Promise<{ id: string | undefined }> {
  const resend = getResend()
  const { data, error } = await resend.emails.send({
    from: getFromAddress(),
    to: Array.isArray(to) ? to : [to],
    subject,
    react,
    replyTo,
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
    subject: isInvite
      ? "Welcome to Legacy Scale — Let's Get Started"
      : 'Welcome to Legacy Scale!',
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
    subject: 'Reset Your Password — Legacy Scale',
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
    subject: `New Announcement: ${title}`,
    react: AnnouncementEmail({ title, body, viewUrl }),
  })
}

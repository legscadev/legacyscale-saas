import { type NextRequest, NextResponse } from 'next/server'
import { render } from '@react-email/components'
import {
  AnnouncementEmail,
  CertificateDeliveryEmail,
  CourseCompleteEmail,
  NudgeEmail,
  PasswordResetEmail,
  WelcomeEmail,
} from '@/emails'
import { getBranding } from '@/lib/branding/get-branding'

// Dev-only HTML preview of email templates.
// Visit: /api/emails/preview/welcome, /api/emails/preview/announcement,
// /api/emails/preview/password-reset, /api/emails/preview/course-complete,
// /api/emails/preview/certificate-delivery, /api/emails/preview/nudge.
import type { Branding } from '@/lib/branding/schema'

function buildTemplates(branding: Branding): Record<string, () => React.ReactElement> {
  return {
    welcome: () =>
      WelcomeEmail({
        name: 'John Doe',
        ctaUrl: 'http://localhost:3000/dashboard',
        branding,
      }),
    'password-reset': () =>
      PasswordResetEmail({
        name: 'John Doe',
        resetUrl: 'http://localhost:3000/reset-password?token=abc123',
        branding,
      }),
    announcement: () =>
      AnnouncementEmail({
        title: 'New Course Available!',
        body: 'We just launched a brand new course on scaling your agency to 7 figures. Check it out now and start learning.',
        viewUrl: 'http://localhost:3000/announcements/sample',
        branding,
      }),
    'course-complete': () =>
      CourseCompleteEmail({
        name: 'John Doe',
        courseTitle: '7-Figure Agency Program',
        completeUrl: 'http://localhost:3000/courses/sample/complete',
        branding,
      }),
    'certificate-delivery': () =>
      CertificateDeliveryEmail({
        name: 'John Doe',
        moduleTitle: 'Foundations',
        courseTitle: '7-Figure Agency Program',
        shortCode: 'ABCD-EF12',
        branding,
      }),
    nudge: () =>
      NudgeEmail({
        name: 'John Doe',
        message:
          'Just a quick nudge — you were making great progress last week. Ready to jump back in?',
        courseTitle: '7-Figure Agency Program',
        ctaUrl: 'http://localhost:3000/dashboard',
        branding,
      }),
  }
}

interface RouteContext {
  params: Promise<{ template: string }>
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Email preview is only available in development' },
      { status: 403 }
    )
  }

  const { template } = await params
  const branding = await getBranding()
  const templates = buildTemplates(branding)
  const factory = templates[template]

  if (!factory) {
    return NextResponse.json(
      {
        error: `Template "${template}" not found`,
        available: Object.keys(templates),
      },
      { status: 404 }
    )
  }

  const html = await render(factory())
  return new NextResponse(html, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}

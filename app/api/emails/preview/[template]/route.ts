import { type NextRequest, NextResponse } from 'next/server'
import { render } from '@react-email/components'
import {
  AnnouncementEmail,
  PasswordResetEmail,
  WelcomeEmail,
} from '@/emails'

// Dev-only HTML preview of email templates.
// Visit: /api/emails/preview/welcome (or password-reset / announcement)
const templates: Record<string, () => React.ReactElement> = {
  welcome: () =>
    WelcomeEmail({
      name: 'John Doe',
      ctaUrl: 'http://localhost:3000/dashboard',
    }),
  'password-reset': () =>
    PasswordResetEmail({
      name: 'John Doe',
      resetUrl: 'http://localhost:3000/reset-password?token=abc123',
    }),
  announcement: () =>
    AnnouncementEmail({
      title: 'New Course Available!',
      body: 'We just launched a brand new course on scaling your agency to 7 figures. Check it out now and start learning.',
      viewUrl: 'http://localhost:3000/announcements/sample',
    }),
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

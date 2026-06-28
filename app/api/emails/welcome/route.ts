import { type NextRequest } from 'next/server'
import { z } from 'zod'
import {
  successResponse,
  validateBody,
  withErrorHandling,
} from '@/lib/api'
import { requireAdminApi } from '@/lib/auth'
import { sendWelcomeEmail } from '@/lib/resend'

const sendWelcomeSchema = z.object({
  email: z.email('Invalid email'),
  name: z.string().min(1).max(100),
})

// POST /api/emails/welcome — admin-only resend of the welcome email.
// Auto-sending on signup is wired in `lib/auth/sync-user.ts`; this route
// is for manual re-sends from the admin UI later.
export const POST = withErrorHandling(async (request: NextRequest) => {
  await requireAdminApi()

  const validation = await validateBody(request, sendWelcomeSchema)
  if (validation.error) return validation.error

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const { id } = await sendWelcomeEmail(
    validation.data.email,
    validation.data.name,
    { ctaUrl: `${appUrl}/dashboard` }
  )

  return successResponse({ id })
})

import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'
import { syncUserToDatabase } from '@/lib/auth/sync-user'

// Whitelist of OTP types we ever email through our own pipeline. Keeps
// the surface narrow — adding a new flow (e.g. signup confirmations
// through Resend) is a conscious addition here.
const ALLOWED_TYPES: ReadonlySet<EmailOtpType> = new Set([
  'recovery',
  'magiclink',
  'invite',
  'email',
])

// Recovery is deferred: we stash the token in an HttpOnly cookie and let
// the user open the form before we burn the one-shot token. The cookie
// is read by /reset-password and consumed by the updatePassword action.
const PW_RESET_COOKIE = 'pw_reset_token'
const ONE_HOUR_SECONDS = 60 * 60

/**
 * Confirms a Supabase email OTP, then redirects to `next`.
 *
 * Recovery flow is deferred: the token is held in an HttpOnly cookie
 * and only verified when the user submits a new password — so opening
 * the link in a new tab or revisiting it within the hour doesn't burn
 * the token prematurely. All other types (magiclink, invite, email)
 * are verified immediately.
 *
 * Used so transactional emails can link to our own domain instead of
 * exposing the Supabase project URL. The email contains
 * `${APP_URL}/auth/confirm?token_hash=...&type=recovery&next=/reset-password`.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const rawType = searchParams.get('type')
  const next = searchParams.get('next') ?? '/dashboard'

  const type = rawType as EmailOtpType | null
  if (!tokenHash || !type || !ALLOWED_TYPES.has(type)) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
  }

  if (type === 'recovery') {
    const response = NextResponse.redirect(`${origin}${next}`)
    response.cookies.set(PW_RESET_COOKIE, tokenHash, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: ONE_HOUR_SECONDS,
    })
    return response
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  })

  if (error) {
    console.error('verifyOtp failed:', error.message)
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
  }

  if (data.user) {
    await syncUserToDatabase(data.user)
  }

  return NextResponse.redirect(`${origin}${next}`)
}

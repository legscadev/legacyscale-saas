'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit'
import { sendPasswordResetEmail } from '@/lib/resend'
import { syncUserToDatabase } from './sync-user'

const PW_RESET_COOKIE = 'pw_reset_token'

/** Discriminated result for auth server actions consumed by forms. */
export type AuthActionState =
  | { error: string }
  | { success: true }
  | undefined

/**
 * Build a user-facing rate-limit error message. We deliberately don't
 * leak the exact remaining counter — that would help an attacker tune
 * their attack just below the threshold.
 */
function rateLimitMessage(retryAfter: number): string {
  if (retryAfter < 60) {
    return `Too many attempts. Try again in ${retryAfter} seconds.`
  }
  const minutes = Math.ceil(retryAfter / 60)
  return `Too many attempts. Try again in ${minutes} minute${
    minutes === 1 ? '' : 's'
  }.`
}

export async function signIn(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')

  // 10 attempts per 5 minutes per IP. Tighter than signup because
  // sign-in is the primary brute-force surface.
  const rl = await checkRateLimit({
    action: 'auth:sign-in',
    windowSec: 300,
    max: 10,
  })
  if (!rl.ok) return { error: rateLimitMessage(rl.retryAfter) }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  if (data.user) {
    const dbUser = await syncUserToDatabase(data.user)
    redirect(dbUser.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard')
  }

  redirect('/dashboard')
}

export async function signUp(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')
  const name = String(formData.get('name') ?? '')

  // 5 sign-ups per 15 minutes per IP — abuse vector is account
  // creation spam + email delivery cost.
  const rl = await checkRateLimit({
    action: 'auth:sign-up',
    windowSec: 900,
    max: 5,
  })
  if (!rl.ok) return { error: rateLimitMessage(rl.retryAfter) }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  })

  if (error) {
    return { error: error.message }
  }

  if (data.user) {
    await syncUserToDatabase(data.user)
  }

  redirect('/dashboard')
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function resetPassword(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get('email') ?? '').toLowerCase().trim()

  // 5 reset requests per 15 minutes per IP — limits email-enumeration
  // scanners and protects send-rate cost on Resend.
  const rl = await checkRateLimit({
    action: 'auth:reset-password',
    windowSec: 900,
    max: 5,
  })
  if (!rl.ok) return { error: rateLimitMessage(rl.retryAfter) }

  // Mint the recovery token via the admin API, then build a link to our
  // own domain so the email never exposes the Supabase project URL. The
  // /auth/confirm route handler will verifyOtp server-side and redirect
  // to the reset page with the session established via cookies.
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
    })

    if (error) {
      // generateLink returns an error if the email isn't in auth.users.
      // We swallow it here so the response is identical regardless of
      // whether the account exists (email enumeration protection).
      console.error('generateLink failed:', error.message)
    } else if (data?.properties?.hashed_token) {
      const dbUser = await prisma.user.findUnique({
        where: { email },
        select: { name: true },
      })
      const displayName =
        dbUser?.name?.trim().split(' ')[0] || email.split('@')[0]

      const params = new URLSearchParams({
        token_hash: data.properties.hashed_token,
        type: 'recovery',
        next: '/reset-password',
      })
      const resetUrl =
        `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm?${params.toString()}`

      try {
        await sendPasswordResetEmail(email, displayName, resetUrl)
      } catch (sendErr) {
        console.error('sendPasswordResetEmail failed:', sendErr)
      }
    }
  } catch (err) {
    console.error('resetPassword unexpected error:', err)
  }

  // Always return the same success response to prevent email enumeration.
  // Real failures get logged but never reach the user — matching the UI
  // copy ("If that email exists...").
  return { success: true }
}

export async function updatePassword(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const password = String(formData.get('password') ?? '')

  // 10 password-set attempts per 15 minutes per IP — bounds token-
  // guessing if the recovery cookie is somehow exposed.
  const rl = await checkRateLimit({
    action: 'auth:update-password',
    windowSec: 900,
    max: 10,
  })
  if (!rl.ok) return { error: rateLimitMessage(rl.retryAfter) }

  const cookieStore = await cookies()
  const tokenHash = cookieStore.get(PW_RESET_COOKIE)?.value

  if (!tokenHash) {
    return { error: 'Reset link expired — please request a new one' }
  }

  const supabase = await createClient()

  // Burn the recovery token now to establish the recovery session, then
  // immediately use that session to set the new password. If verifyOtp
  // fails, clear the bad cookie so the user gets a clean retry state.
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'recovery',
  })

  if (verifyErr) {
    console.error('verifyOtp failed during reset:', verifyErr.message)
    cookieStore.delete(PW_RESET_COOKIE)
    return {
      error: 'Reset link is invalid or has expired — please request a new one',
    }
  }

  const { error: updateErr } = await supabase.auth.updateUser({ password })

  if (updateErr) {
    return { error: updateErr.message }
  }

  cookieStore.delete(PW_RESET_COOKIE)
  redirect('/dashboard')
}

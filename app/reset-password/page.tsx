'use client'

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { BrandMark } from '@/components/layout/brand-mark'
import { PasswordInput } from '@/components/auth/password-input'
import { createClient } from '@/lib/supabase/client'
import { updatePassword } from '@/lib/auth/actions'

type Status = 'checking' | 'ready' | 'invalid'

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>('checking')

  useEffect(() => {
    const supabase = createClient()

    // The recovery flow lands here with implicit tokens in the URL hash.
    // @supabase/ssr defaults to PKCE and doesn't auto-process them, so
    // we read the hash ourselves and call setSession. If no hash, fall
    // back to whatever cookie session already exists.
    const params = new URLSearchParams(window.location.hash.slice(1))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    if (accessToken && refreshToken) {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          if (error) {
            setStatus('invalid')
          } else {
            // Strip tokens from the URL so they're not exposed in history
            // or shared if the user copies the link.
            window.history.replaceState(null, '', window.location.pathname)
            setStatus('ready')
          }
        })
    } else {
      supabase.auth
        .getSession()
        .then(({ data: { session } }) =>
          setStatus(session ? 'ready' : 'invalid')
        )
    }
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <BrandMark />
        {status === 'checking' && <CheckingState />}
        {status === 'invalid' && <InvalidState />}
        {status === 'ready' && <ResetForm />}
      </div>
    </main>
  )
}

function CheckingState() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      Verifying your reset link…
    </div>
  )
}

function InvalidState() {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          Reset link invalid
        </h1>
        <p className="text-sm text-muted-foreground">
          This password reset link is invalid or has expired. Request a new
          one to continue.
        </p>
      </div>
      <Link
        href="/forgot-password"
        className="inline-flex items-center gap-1.5 text-sm
          font-medium text-primary transition-colors hover:underline"
      >
        <ArrowLeft className="size-4" />
        Request a new link
      </Link>
    </div>
  )
}

function ResetForm() {
  const [state, formAction, pending] = useActionState(updatePassword, undefined)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const mismatch = confirm.length > 0 && password !== confirm

  return (
    <>
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          Set a new password
        </h1>
        <p className="text-sm text-muted-foreground">
          Choose a strong password you don&apos;t use anywhere else.
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <PasswordInput
            id="password"
            name="password"
            placeholder="••••••••"
            required
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            minLength={8}
          />
          <p className="text-xs text-muted-foreground">
            Must be at least 8 characters.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <PasswordInput
            id="confirm"
            name="confirm"
            placeholder="••••••••"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={setConfirm}
          />
          {mismatch && (
            <p className="text-xs text-destructive">
              Passwords don&apos;t match.
            </p>
          )}
        </div>

        {state && 'error' in state && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={pending || mismatch}
        >
          {pending ? 'Updating…' : 'Update password'}
          {!pending && <ArrowRight />}
        </Button>
      </form>
    </>
  )
}

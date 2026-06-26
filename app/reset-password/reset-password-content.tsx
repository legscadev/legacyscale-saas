'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { BrandMark } from '@/components/layout/brand-mark'
import { PasswordInput } from '@/components/auth/password-input'
import { updatePassword } from '@/lib/auth/actions'

interface ResetPasswordContentProps {
  hasToken: boolean
}

export function ResetPasswordContent({ hasToken }: ResetPasswordContentProps) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <BrandMark />
        {hasToken ? <ResetForm /> : <InvalidState />}
      </div>
    </main>
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
            minLength={4}
          />
          <p className="text-xs text-muted-foreground">
            Must be at least 4 characters.
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
          loading={pending}
          disabled={mismatch}
        >
          {pending ? 'Updating…' : 'Update password'}
          {!pending && <ArrowRight />}
        </Button>
      </form>
    </>
  )
}

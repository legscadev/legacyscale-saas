'use client'

import { useActionState, useState } from 'react'
import { ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { BrandMark } from '@/components/layout/brand-mark'
import { PasswordInput } from '@/components/auth/password-input'
import { updatePassword } from '@/lib/auth/actions'

export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(updatePassword, undefined)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const mismatch = confirm.length > 0 && password !== confirm

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <BrandMark />

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
      </div>
    </main>
  )
}

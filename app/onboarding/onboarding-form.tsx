'use client'

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/auth/password-input'
import { onboardingFormSchema } from '@/lib/validations/onboarding'

interface OnboardingFormProps {
  token: string
}

export function OnboardingForm({ token }: OnboardingFormProps) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<'password' | 'confirm', string[]>>
  >({})

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    const parsed = onboardingFormSchema.safeParse({ password, confirm })
    if (!parsed.success) {
      const next: typeof fieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (key === 'password' || key === 'confirm') {
          if (!next[key]) next[key] = []
          next[key]!.push(issue.message)
        }
      }
      setFieldErrors(next)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...parsed.data, token }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? 'Failed to complete onboarding')
        return
      }
      // Hard navigation so the new session cookie is picked up by the
      // server-rendered shell.
      window.location.href = json.data.redirectTo ?? '/dashboard'
    } catch (err) {
      console.error(err)
      setError('Network error — please try again')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <PasswordInput
          id="password"
          name="password"
          placeholder="••••••••"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          minLength={8}
        />
        {fieldErrors.password?.[0] ? (
          <p className="text-xs text-destructive" role="alert">
            {fieldErrors.password[0]}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Must be at least 8 characters, with upper and lower case letters
            and a number.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm password</Label>
        <PasswordInput
          id="confirm"
          name="confirm"
          placeholder="••••••••"
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
        />
        {fieldErrors.confirm?.[0] && (
          <p className="text-xs text-destructive" role="alert">
            {fieldErrors.confirm[0]}
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={submitting}
      >
        {submitting ? 'Setting up…' : 'Set password and continue'}
        {!submitting && <ArrowRight />}
      </Button>
    </form>
  )
}

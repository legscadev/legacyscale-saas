'use client'

import { useState, useTransition } from 'react'
import { KeyRound } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/auth/password-input'
import { changePasswordSchema } from '@/lib/validations/auth'
import { updatePassword } from './actions'

type FieldErrors = Partial<
  Record<'currentPassword' | 'newPassword' | 'confirmPassword', string[]>
>

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const reset = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setFieldErrors({})
    setError(null)
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    const parsed = changePasswordSchema.safeParse({
      currentPassword,
      newPassword,
      confirmPassword,
    })
    if (!parsed.success) {
      const next: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (
          key === 'currentPassword' ||
          key === 'newPassword' ||
          key === 'confirmPassword'
        ) {
          if (!next[key]) next[key] = []
          next[key]!.push(issue.message)
        }
      }
      setFieldErrors(next)
      return
    }

    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await updatePassword(formData)
      if (result.success) {
        toast.success('Password updated')
        reset()
      } else if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors)
      } else {
        setError(result.error ?? 'Could not update password')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Current password</Label>
        <PasswordInput
          id="currentPassword"
          name="currentPassword"
          placeholder="••••••••"
          autoComplete="current-password"
          value={currentPassword}
          onChange={setCurrentPassword}
        />
        {fieldErrors.currentPassword?.[0] && (
          <p className="text-xs text-destructive" role="alert">
            {fieldErrors.currentPassword[0]}
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="newPassword">New password</Label>
          <PasswordInput
            id="newPassword"
            name="newPassword"
            placeholder="••••••••"
            autoComplete="new-password"
            value={newPassword}
            onChange={setNewPassword}
            minLength={8}
          />
          {fieldErrors.newPassword?.[0] ? (
            <p className="text-xs text-destructive" role="alert">
              {fieldErrors.newPassword[0]}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              At least 8 characters, with upper and lower case letters and
              a number.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            placeholder="••••••••"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
          />
          {fieldErrors.confirmPassword?.[0] && (
            <p className="text-xs text-destructive" role="alert">
              {fieldErrors.confirmPassword[0]}
            </p>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        <KeyRound />
        {isPending ? 'Updating…' : 'Update password'}
      </Button>
    </form>
  )
}

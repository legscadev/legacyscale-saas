'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { resetPassword } from '@/lib/auth/actions'

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(resetPassword, undefined)

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-center text-2xl">Forgot password?</CardTitle>
        <CardDescription className="text-center">
          Enter your email and we&apos;ll send you a reset link
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>
          {state && 'success' in state && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              If that email exists, a reset link is on its way.
            </p>
          )}
          {state && 'error' in state && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Sending…' : 'Send Reset Link'}
          </Button>
        </form>

        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>
      </CardContent>
    </Card>
  )
}

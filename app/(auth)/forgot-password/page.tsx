'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Mail } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BrandMark } from '@/components/layout/brand-mark'
import { resetPassword } from '@/lib/auth/actions'

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(resetPassword, undefined)

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-5 text-center">
        <Link href="/" aria-label="Kondense">
          <BrandMark />
        </Link>
        <div className="space-y-1.5">
          <h1 className="text-3xl font-semibold tracking-tight">
            Reset your password
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your email and we&apos;ll send you a link to reset it.
          </p>
        </div>
      </div>

      <Card variant="raised" className="p-6 sm:p-7">
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@agency.com"
                required
                autoComplete="email"
                className="pl-9"
              />
            </div>
          </div>

          {state && 'success' in state && (
            <div
              role="status"
              className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400"
            >
              If that email exists, a reset link is on its way.
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            loading={pending}
          >
            {pending ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      </Card>

      <Link
        href="/login"
        className="flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to sign in
      </Link>
    </div>
  )
}

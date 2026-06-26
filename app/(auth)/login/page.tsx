'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { ArrowRight, Mail } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BrandMark } from '@/components/layout/brand-mark'
import { PasswordInput } from '@/components/auth/password-input'
import { signIn } from '@/lib/auth/actions'

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, undefined)

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-5 text-center">
        <Link href="/" aria-label="Kondense">
          <BrandMark />
        </Link>
        <div className="space-y-1.5">
          <h1 className="text-3xl font-semibold tracking-tight">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to continue building your agency.
          </p>
        </div>
      </div>

      <Card variant="flat" className="p-6 sm:p-7">
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              id="password"
              name="password"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Checkbox defaultChecked />
            Keep me signed in
          </label>

          {state && 'error' in state && (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {state.error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            loading={pending}
          >
            {pending ? 'Signing in…' : 'Sign in'}
            {!pending && <ArrowRight />}
          </Button>
        </form>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Access is granted after enrollment. Need help getting in?{' '}
        <Link
          href="mailto:support@kondense.ai"
          className="font-medium text-foreground hover:underline"
        >
          Contact support
        </Link>
      </p>
    </div>
  )
}

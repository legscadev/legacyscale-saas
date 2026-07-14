'use client'

import { BrandMark } from '@/components/layout/brand-mark'
import { PasswordStep } from './password-step'

interface AdminPasswordOnboardingProps {
  token: string
  /** Name of the tenant this admin is being onboarded into. Non-null
   *  only when the invite came from the super/create-company flow
   *  (see app/onboarding/page.tsx). When null, we skip the "You're
   *  the owner of X" callout — this is a Kondense-side admin, not a
   *  freshly-handed sub-tenant owner. */
  companyName?: string | null
}

/**
 * Admin onboarding is intentionally a single screen: set the password
 * and land on the dashboard. No welcome, no profile, no goal. Admins
 * are the operators of the platform — they don't need the same
 * marketing-style intro as members.
 *
 * When `companyName` is set, we surface a one-line "You're the owner
 * of {companyName}" header above the password field so the recipient
 * knows which tenant they're stepping into.
 */
export function AdminPasswordOnboarding({
  token,
  companyName,
}: AdminPasswordOnboardingProps) {
  const handleSuccess = async (redirectTo: string) => {
    // Mark the invite consumed so the link can't be reused. Best-effort;
    // a failed mark shouldn't block the admin from reaching the
    // dashboard.
    try {
      await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
    } catch (err) {
      console.error('Failed to mark invite complete:', err)
    }
    // Hard navigation so the new session cookie is picked up by the
    // server-rendered shell.
    window.location.href = redirectTo
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <BrandMark />
        {companyName ? (
          <div className="space-y-1.5 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              You&apos;re the owner of
            </p>
            <p className="text-lg font-semibold">{companyName}</p>
            <p className="text-sm text-muted-foreground">
              Set a password to open your admin console.
            </p>
          </div>
        ) : null}
        <PasswordStep token={token} onSuccess={handleSuccess} />
      </div>
    </main>
  )
}
